import 'server-only'
import { serverEnv } from '@/config/env.server'
import { logger } from '@/lib/logging/logger'
import { BUCKETS, StorageUnavailableError, type Bucket, type ImageStore } from './store'

/**
 * Supabase Storage, through its REST API, with a server-only secret key.
 *
 * Why a secret key at all (docs/product-spec.md 7.3): Supabase rejects deleting
 * storage objects with SQL, so removing a file needs the Storage API; and
 * cleanup, moderation removals and account deletion run with no user session.
 *
 * The key never leaves this module and is never logged. New-format keys
 * (`sb_secret_…`) go in the `apikey` header only, as Supabase requires; a
 * legacy service-role JWT is also sent as a bearer token.
 *
 * Both buckets are private. Files are only ever served through /media, which
 * checks access first, so neither bucket is publicly readable.
 */

const MAX_FILE_BYTES = 6 * 1024 * 1024
const TIMEOUT_MS = 20_000

export class SupabaseImageStore implements ImageStore {
  readonly kind = 'supabase' as const
  private readonly base: string
  private readonly key: string
  private bucketsReady: Promise<void> | null = null

  constructor() {
    const env = serverEnv()
    if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SECRET_KEY) {
      throw new StorageUnavailableError(
        'Image storage needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY.',
      )
    }
    this.base = `${env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/storage/v1`
    this.key = env.SUPABASE_SECRET_KEY
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    const headers: Record<string, string> = { apikey: this.key, ...extra }
    if (!this.key.startsWith('sb_')) headers.Authorization = `Bearer ${this.key}`
    return headers
  }

  private async call(path: string, init: RequestInit): Promise<Response> {
    return fetch(`${this.base}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  }

  /** Create the private buckets once per process, if they do not exist. */
  private ensureBuckets(): Promise<void> {
    this.bucketsReady ??= (async () => {
      for (const id of BUCKETS) {
        const response = await this.call('/bucket', {
          method: 'POST',
          headers: this.headers({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({
            id,
            name: id,
            public: false,
            file_size_limit: MAX_FILE_BYTES,
            allowed_mime_types: ['image/webp'],
          }),
        })
        // 400/409 with "already exists" is the normal case after the first run.
        if (!response.ok && response.status !== 409 && response.status !== 400) {
          throw new Error(`could not create storage bucket ${id} (${response.status})`)
        }
      }
    })().catch((error: unknown) => {
      this.bucketsReady = null
      throw error
    })
    return this.bucketsReady
  }

  async put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void> {
    await this.ensureBuckets()
    const response = await this.call(`/object/${bucket}/${encodePath(key)}`, {
      method: 'POST',
      headers: this.headers({ 'Content-Type': contentType, 'x-upsert': 'true' }),
      body: new Uint8Array(body),
    })
    if (!response.ok) throw new Error(`storage upload failed (${response.status})`)
  }

  async get(bucket: Bucket, key: string): Promise<Buffer | null> {
    const response = await this.call(`/object/authenticated/${bucket}/${encodePath(key)}`, {
      method: 'GET',
      headers: this.headers(),
    })
    if (response.status === 404 || response.status === 400) return null
    if (!response.ok) throw new Error(`storage download failed (${response.status})`)
    return Buffer.from(await response.arrayBuffer())
  }

  async remove(bucket: Bucket, keys: readonly string[]): Promise<void> {
    if (keys.length === 0) return
    const response = await this.call(`/object/${bucket}`, {
      method: 'DELETE',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prefixes: keys }),
    })
    if (!response.ok && response.status !== 404) {
      logger.warn('storage delete failed', { bucket, status: response.status })
      throw new Error(`storage delete failed (${response.status})`)
    }
  }
}

function encodePath(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}
