import { serverEnv } from '@/config/env.server'
import type { MerchantDescriptor } from '@/lib/merchants/provider'
import { logger } from '@/lib/logging/logger'
import {
  ProviderAuthError,
  ProviderRateLimitError,
  ProviderResponseError,
  ProviderUnavailableError,
  type CatalogFetchOptions,
  type CatalogPage,
  type CatalogProvider,
  type ProviderReadiness,
  type RawCatalogProduct,
} from '@/lib/providers/types'

/**
 * Flipkart Affiliate API — product feed.
 *
 * The one provider under evaluation that publishes an actual product catalogue
 * over HTTP. Endpoints, headers, pagination and field names below come from
 * Flipkart's published affiliate API reference:
 *
 *   auth        Fk-Affiliate-Id / Fk-Affiliate-Token request headers
 *   listing     /affiliate/api/<trackingId>.json          (categories available)
 *   feed        /affiliate/1.0/feeds/<trackingId>/category/<category>.json
 *   delta       /affiliate/1.0/deltaFeeds/<trackingId>/category/<category>.json
 *   paging      response `nextUrl`, 500 products per page
 *   envelope    { nextUrl, validTill, productInfoList: [{ productBaseInfoV1 }] }
 *
 * NOT YET RUN AGAINST A LIVE ACCOUNT. No affiliate credentials exist in this
 * project, and Flipkart's public API changelog has not been revised since 2016,
 * so both the programme's current availability and the exact live envelope must
 * be confirmed before this is enabled. The parsing below is therefore
 * deliberately defensive: it accepts the v1.1.0 and v0.1.0 field names, prices
 * as either an object or a bare number, and treats every field it cannot read
 * as missing rather than guessing. A product that cannot be read is skipped and
 * counted — never approximated.
 *
 * See docs/product-data.md for what is required to switch this on.
 */

const API_HOST = 'https://affiliate-api.flipkart.net'
const DEFAULT_TIMEOUT_MS = 20_000

const FLIPKART_MERCHANT: MerchantDescriptor = {
  name: 'Flipkart',
  slug: 'flipkart',
  websiteUrl: 'https://www.flipkart.com',
  // Outbound redirects are refused to any host not listed here.
  allowedHosts: ['flipkart.com', 'dl.flipkart.com'],
}

export interface FlipkartProviderOptions {
  /** Feed categories to walk. Category ids come from the listing endpoint. */
  categories?: string[]
  timeoutMs?: number
  /** Injected in tests so no network call is made. */
  fetchImpl?: typeof fetch
}

export class FlipkartCatalogProvider implements CatalogProvider {
  readonly id = 'flipkart' as const

  private readonly categories: string[]
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly log = logger.child({ provider: 'flipkart' })

  constructor(options: FlipkartProviderOptions = {}) {
    const env = serverEnv()
    this.categories =
      options.categories ??
      (env.FLIPKART_FEED_CATEGORIES ? env.FLIPKART_FEED_CATEGORIES.split(',') : [])
        .map((value) => value.trim())
        .filter(Boolean)
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  readiness(): ProviderReadiness {
    const env = serverEnv()
    const missing: string[] = []
    if (!env.FLIPKART_AFFILIATE_TRACKING_ID) missing.push('FLIPKART_AFFILIATE_TRACKING_ID')
    if (!env.FLIPKART_AFFILIATE_TOKEN) missing.push('FLIPKART_AFFILIATE_TOKEN')

    if (missing.length > 0) {
      return {
        ready: false,
        reason: 'Flipkart affiliate credentials are not configured.',
        missing,
      }
    }
    if (this.categories.length === 0) {
      return {
        ready: false,
        reason:
          'No feed categories selected. Set FLIPKART_FEED_CATEGORIES to a comma-separated list ' +
          'of category ids from the affiliate listing endpoint.',
        missing: ['FLIPKART_FEED_CATEGORIES'],
      }
    }
    return { ready: true }
  }

  /**
   * One page of products.
   *
   * `cursor` is Flipkart's own absolute `nextUrl`. Using the provider's cursor
   * verbatim rather than reconstructing page numbers means a mid-feed change in
   * their paging scheme cannot silently skip or repeat products.
   */
  async getProducts(options: CatalogFetchOptions = {}): Promise<CatalogPage> {
    const readiness = this.readiness()
    if (!readiness.ready) {
      throw new ProviderAuthError('flipkart', readiness.reason)
    }

    const env = serverEnv()
    const url = options.cursor ?? this.feedUrl(this.categories[0])
    const payload = await this.request(
      url,
      {
        'Fk-Affiliate-Id': env.FLIPKART_AFFILIATE_TRACKING_ID!,
        'Fk-Affiliate-Token': env.FLIPKART_AFFILIATE_TOKEN!,
      },
      options.signal,
    )

    const list = Array.isArray(payload.productInfoList) ? payload.productInfoList : []
    const products: RawCatalogProduct[] = []

    for (const entry of list) {
      const raw = mapFlipkartProduct(entry)
      if (raw) products.push(raw)
      else this.log.warn('skipped unreadable flipkart product')
    }

    // A feed page that yields nothing usable is a signal, not a non-event.
    if (list.length > 0 && products.length === 0) {
      this.log.warn('flipkart page produced no readable products', { received: list.length })
    }

    return {
      products,
      cursor: typeof payload.nextUrl === 'string' && payload.nextUrl ? payload.nextUrl : null,
    }
  }

  private feedUrl(category: string): string {
    const env = serverEnv()
    const trackingId = encodeURIComponent(env.FLIPKART_AFFILIATE_TRACKING_ID!)
    return `${API_HOST}/affiliate/1.0/feeds/${trackingId}/category/${encodeURIComponent(category)}.json`
  }

  /**
   * One HTTP call, with every documented failure mode mapped to a typed error.
   *
   * The runner uses those types to decide whether to end the run cleanly
   * (auth, rate limit, outage) or carry on. Nothing here logs a credential.
   */
  private async request(
    url: string,
    headers: Record<string, string>,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>> {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

    let response: Response
    try {
      response = await this.fetchImpl(url, { headers, signal: combined, redirect: 'follow' })
    } catch (error) {
      throw new ProviderUnavailableError('flipkart', 'Flipkart feed request failed', error)
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderAuthError(
        'flipkart',
        `Flipkart rejected the credentials (${response.status})`,
      )
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get('retry-after'))
      throw new ProviderRateLimitError(
        'flipkart',
        'Flipkart rate limit reached',
        Number.isFinite(retryAfter) ? retryAfter : undefined,
      )
    }
    if (response.status >= 500) {
      throw new ProviderUnavailableError('flipkart', `Flipkart returned ${response.status}`)
    }
    if (!response.ok) {
      throw new ProviderResponseError('flipkart', `Flipkart returned ${response.status}`)
    }

    try {
      const body: unknown = await response.json()
      if (!body || typeof body !== 'object') {
        throw new Error('response body was not an object')
      }
      return body as Record<string, unknown>
    } catch (error) {
      throw new ProviderResponseError('flipkart', 'Flipkart response was not valid JSON', error)
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Mapping                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One `productInfoList` entry to LivinUp's raw shape.
 *
 * Exported for tests. Returns null when the entry lacks the fields that make a
 * product identifiable and purchasable — an id, a title, a URL and a price.
 * Everything else is optional, and absent means absent.
 */
export function mapFlipkartProduct(entry: unknown): RawCatalogProduct | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>

  // v1.1.0 nests under productBaseInfoV1; the deprecated v0.1.0 used
  // productBaseInfo. Accept either, prefer the current one.
  const base = asRecord(record.productBaseInfoV1) ?? asRecord(record.productBaseInfo) ?? record

  const externalId = asString(base.productId)
  const title = asString(base.title)
  const productUrl = asString(base.productUrl)
  const price = asAmount(base.flipkartSellingPrice) ?? asAmount(base.sellingPrice)

  if (!externalId || !title || !productUrl || price === null) return null

  const mrp = asAmount(base.maximumRetailPrice)
  const currency =
    asCurrency(base.flipkartSellingPrice) ?? asCurrency(base.maximumRetailPrice) ?? 'INR'

  return {
    externalId,
    title,
    description: asString(base.productDescription) ?? undefined,
    brand: asString(base.productBrand) ?? undefined,
    category: categoryFrom(base),
    productUrl,
    imageUrl: largestImage(base.imageUrls) ?? undefined,
    images: allImages(base.imageUrls),
    price,
    // An MRP at or below the selling price is not a discount; the normalizer
    // drops it, and the check constraint refuses it regardless.
    originalPrice: mrp !== null && mrp > price ? mrp : null,
    currency,
    availability: base.inStock === true ? 'in_stock' : 'out_of_stock',
    merchant: FLIPKART_MERCHANT,
    attributes: {},
    raw: { productBaseInfoV1: base },
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

/** Flipkart money fields are `{ amount, currency }`; tolerate a bare number too. */
function asAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const record = asRecord(value)
  if (!record) return null
  const amount = record.amount
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

function asCurrency(value: unknown): string | null {
  const record = asRecord(value)
  const currency = record?.currency
  return typeof currency === 'string' && currency.length === 3 ? currency.toUpperCase() : null
}

/**
 * `imageUrls` is keyed by resolution ("200x200", "400x400", …). Pick the
 * largest by pixel area rather than trusting key order.
 */
function largestImage(value: unknown): string | null {
  const images = allImages(value)
  return images[0] ?? null
}

function allImages(value: unknown): string[] {
  const record = asRecord(value)
  if (!record) return typeof value === 'string' ? [value] : []

  const entries: Array<{ area: number; url: string }> = []
  for (const [key, url] of Object.entries(record)) {
    if (typeof url !== 'string' || url.trim() === '') continue
    const match = /^(\d+)x(\d+)$/.exec(key)
    const area = match ? Number(match[1]) * Number(match[2]) : 0
    entries.push({ area, url })
  }

  return entries.sort((a, b) => b.area - a.area).map((entry) => entry.url)
}

/** Category comes as a nested path array; the leaf is the most specific term. */
function categoryFrom(base: Record<string, unknown>): string | undefined {
  const paths = base.categoryPaths ?? base.categoryPath
  if (typeof paths === 'string') return paths

  // Documented shape is an array of paths, each an array of { title }.
  if (Array.isArray(paths)) {
    const first = paths[0]
    const segments = Array.isArray(first) ? first : paths
    const titles = segments
      .map((segment) => asString(asRecord(segment)?.title))
      .filter((value): value is string => Boolean(value))
    if (titles.length > 0) return titles.join(' > ')
  }
  return undefined
}
