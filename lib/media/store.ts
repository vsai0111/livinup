import 'server-only'
import { resolveMediaDriver } from '@/config/env.server'

/**
 * The image storage seam.
 *
 * Files are addressed by bucket and key. Two buckets, both private:
 *
 *   wardrobe        an owner's clothing photos. Never shown to anyone else.
 *   public-content  copies made for published posts and avatars.
 *
 * "Private" is enforced by never exposing the store directly: every image is
 * served through /media/[id]/[size], which checks access first. The local
 * implementation writes to disk (development and tests); the Supabase one uses
 * the Storage API with a server-only secret key.
 */

export const BUCKETS = ['wardrobe', 'public-content'] as const
export type Bucket = (typeof BUCKETS)[number]

export interface ImageStore {
  readonly kind: 'local' | 'supabase'
  put(bucket: Bucket, key: string, body: Buffer, contentType: string): Promise<void>
  /** Null when the object does not exist. */
  get(bucket: Bucket, key: string): Promise<Buffer | null>
  /** Remove objects. Missing objects are not an error. */
  remove(bucket: Bucket, keys: readonly string[]): Promise<void>
}

/** Raised when production has no usable store (no secret key configured). */
export class StorageUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StorageUnavailableError'
  }
}

declare global {
  var __livinupImageStore: ImageStore | undefined
}

export async function getImageStore(): Promise<ImageStore> {
  if (globalThis.__livinupImageStore) return globalThis.__livinupImageStore

  const driver = resolveMediaDriver()
  const store =
    driver === 'supabase'
      ? new (await import('./supabase-store')).SupabaseImageStore()
      : new (await import('./local-store')).LocalImageStore()

  globalThis.__livinupImageStore = store
  return store
}

/** Test hook: use a specific store. */
export function setImageStoreForTests(store: ImageStore | undefined): void {
  globalThis.__livinupImageStore = store
}
