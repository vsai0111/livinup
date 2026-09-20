import { serverEnv } from '@/config/env.server'
import { logger } from '@/lib/logging/logger'
import type { AffiliateContext } from '@/lib/merchants/provider'
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderUnavailableError,
  type DeeplinkProvider,
  type ProviderReadiness,
} from '@/lib/providers/types'
import { isSafeHttpUrl } from '@/lib/utils/url'

/**
 * Cuelinks — link monetisation.
 *
 * Cuelinks is NOT a catalogue source. Its published API covers campaign
 * discovery, URL-to-tracked-link conversion, transactions and reporting; there
 * is no product feed endpoint returning titles, prices, images or brands. So it
 * implements `DeeplinkProvider` only, and nothing in the ingestion pipeline
 * asks it for products.
 *
 * That is worth stating plainly because it changes what Cuelinks is *for* here:
 * it monetises links to merchants whose catalogue LivinUp obtained elsewhere —
 * or, later, merchants whose products a user reaches by search — rather than
 * supplying the catalogue itself.
 *
 * Auth is a scoped API key sent as `Authorization: Token <key>`, generated in
 * the Cuelinks dashboard under Resource Centre -> API Key.
 *
 * NOT YET RUN AGAINST A LIVE ACCOUNT. No Cuelinks key exists in this project.
 * The conversion endpoint path is configurable rather than hard-coded, because
 * the exact route must be confirmed against the account's own API reference
 * before this is switched on.
 */

const DEFAULT_TIMEOUT_MS = 8_000

export interface CuelinksProviderOptions {
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

export class CuelinksDeeplinkProvider implements DeeplinkProvider {
  readonly id = 'cuelinks' as const

  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly log = logger.child({ provider: 'cuelinks' })

  constructor(options: CuelinksProviderOptions = {}) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  readiness(): ProviderReadiness {
    const env = serverEnv()
    const missing: string[] = []
    if (!env.CUELINKS_API_KEY) missing.push('CUELINKS_API_KEY')
    if (!env.CUELINKS_CONVERT_URL) missing.push('CUELINKS_CONVERT_URL')

    if (missing.length > 0) {
      return {
        ready: false,
        reason: 'Cuelinks API key or conversion endpoint is not configured.',
        missing,
      }
    }
    return { ready: true }
  }

  /**
   * Convert a destination URL into a tracked one.
   *
   * Returns null on any failure rather than throwing. A click is a live user
   * request: if the network is slow, rate-limiting us, or down, the right
   * outcome is an untracked click-through to the merchant, not a broken link.
   * The lost commission is logged; the user never sees a failure.
   */
  async createDeeplink(destinationUrl: string, context: AffiliateContext): Promise<string | null> {
    const readiness = this.readiness()
    if (!readiness.ready) return null
    if (!isSafeHttpUrl(destinationUrl)) return null

    const env = serverEnv()

    try {
      const response = await this.fetchImpl(env.CUELINKS_CONVERT_URL!, {
        method: 'POST',
        headers: {
          Authorization: `Token ${env.CUELINKS_API_KEY}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        // `subid` carries LivinUp's own click id so a network postback can be
        // reconciled against the click row we already wrote.
        body: JSON.stringify({ url: destinationUrl, subid: context.clickId }),
        signal: AbortSignal.timeout(this.timeoutMs),
      })

      if (response.status === 401 || response.status === 403) {
        throw new ProviderAuthError(
          'cuelinks',
          `Cuelinks rejected the API key (${response.status})`,
        )
      }
      if (response.status === 429) {
        throw new ProviderRateLimitError('cuelinks', 'Cuelinks rate limit reached')
      }
      if (!response.ok) {
        throw new ProviderUnavailableError('cuelinks', `Cuelinks returned ${response.status}`)
      }

      const body: unknown = await response.json()
      const tracked = extractTrackingUrl(body)
      if (!tracked) {
        throw new ProviderResponseError('cuelinks', 'No tracking URL in Cuelinks response')
      }
      // Never follow a URL the network returned without checking its scheme.
      return isSafeHttpUrl(tracked) ? tracked : null
    } catch (error) {
      // Degrade to the plain URL. Log the class of failure, never the key.
      this.log.warn('cuelinks deeplink unavailable, falling back to direct URL', {
        error: error instanceof Error ? error.name : 'unknown',
      })
      return null
    }
  }
}

/**
 * Pull the tracked URL out of the response.
 *
 * Accepts the documented `tracking_url` and the common alternatives, because
 * the exact key is one of the things that must be confirmed against a live
 * account. Exported for tests.
 */
export function extractTrackingUrl(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const record = body as Record<string, unknown>

  for (const key of ['tracking_url', 'trackingUrl', 'url', 'link', 'deeplink']) {
    const value = record[key]
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }

  // Some responses nest the payload one level down.
  for (const key of ['data', 'result', 'link']) {
    const nested = record[key]
    if (nested && typeof nested === 'object') {
      const found = extractTrackingUrl(nested)
      if (found) return found
    }
  }

  return null
}
