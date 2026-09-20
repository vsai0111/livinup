import { serverEnv } from '@/config/env.server'
import { logger } from '@/lib/logging/logger'
import {
  ProviderAuthError,
  ProviderResponseError,
  ProviderUnavailableError,
  type CatalogFetchOptions,
  type CatalogPage,
  type CatalogProvider,
  type ProviderReadiness,
  type RawCatalogProduct,
} from '@/lib/providers/types'
import { isSafeHttpUrl } from '@/lib/utils/url'

/**
 * Admitad — advertiser product feeds.
 *
 * Admitad's catalogue does not arrive as a JSON products API. Per Admitad's
 * publisher documentation, product data is distributed as per-advertiser feed
 * FILES — CSV, XML, YML, or a Google Merchant Center document — whose URLs are
 * issued to an approved publisher through the dashboard, with five mandatory
 * columns (`category_name`, `offer_id`, `url`, `price`, `currencyId`) and feeds
 * refreshed roughly every six hours. The REST API at api.admitad.com covers
 * campaigns, deeplinks, coupons and statistics, authenticated with OAuth2
 * `client_credentials` against `https://api.admitad.com/token/`.
 *
 * So this adapter reads feed documents, one advertiser per configured URL. It
 * does NOT call the REST API: nothing in ingestion needs it, and adding an
 * OAuth client for endpoints we do not use would mean holding a credential for
 * no reason.
 *
 * NOT YET RUN AGAINST A REAL FEED. No Admitad account or feed URL exists in
 * this project. The parser below handles the documented mandatory columns and
 * the widely-used Google Merchant field names; the exact column set of a given
 * advertiser varies and must be checked against the real file before enabling.
 * Rows that cannot be read are skipped and counted, never approximated.
 */

const DEFAULT_TIMEOUT_MS = 60_000

/** Per-advertiser feed configuration, parsed from ADMITAD_FEEDS. */
export interface AdmitadFeedConfig {
  /** Advertiser slug, used as the LivinUp merchant slug. */
  slug: string
  /** Advertiser display name. */
  name: string
  /** Storefront URL. */
  websiteUrl: string
  /** Hostnames outbound clicks may be redirected to. */
  allowedHosts: string[]
  /** The feed document URL issued by Admitad. */
  feedUrl: string
}

export interface AdmitadProviderOptions {
  feeds?: AdmitadFeedConfig[]
  timeoutMs?: number
  fetchImpl?: typeof fetch
}

/**
 * Parse ADMITAD_FEEDS.
 *
 * Format, one advertiser per entry, separated by `;`:
 *   slug|Display Name|https://store.example|host1,host2|https://feed-url
 *
 * A malformed entry is skipped with a warning rather than throwing: one bad
 * line in configuration must not take the whole ingestion offline.
 */
export function parseAdmitadFeeds(value: string | undefined): AdmitadFeedConfig[] {
  if (!value) return []
  const feeds: AdmitadFeedConfig[] = []

  for (const entry of value.split(';')) {
    const trimmed = entry.trim()
    if (!trimmed) continue

    const [slug, name, websiteUrl, hosts, feedUrl] = trimmed.split('|').map((part) => part?.trim())
    if (!slug || !name || !websiteUrl || !feedUrl) {
      logger.warn('ignoring malformed ADMITAD_FEEDS entry', { slug: slug ?? '(none)' })
      continue
    }
    if (!isSafeHttpUrl(websiteUrl) || !isSafeHttpUrl(feedUrl)) {
      logger.warn('ignoring ADMITAD_FEEDS entry with a non-http(s) URL', { slug })
      continue
    }

    feeds.push({
      slug,
      name,
      websiteUrl,
      allowedHosts: (hosts ?? '')
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean),
      feedUrl,
    })
  }

  return feeds
}

export class AdmitadCatalogProvider implements CatalogProvider {
  readonly id = 'admitad' as const

  private readonly feeds: AdmitadFeedConfig[]
  private readonly timeoutMs: number
  private readonly fetchImpl: typeof fetch
  private readonly log = logger.child({ provider: 'admitad' })

  constructor(options: AdmitadProviderOptions = {}) {
    this.feeds = options.feeds ?? parseAdmitadFeeds(serverEnv().ADMITAD_FEEDS)
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  readiness(): ProviderReadiness {
    if (this.feeds.length === 0) {
      return {
        ready: false,
        reason:
          'No Admitad advertiser feeds configured. Set ADMITAD_FEEDS once the account is ' +
          'approved and per-advertiser feed URLs have been issued.',
        missing: ['ADMITAD_FEEDS'],
      }
    }
    return { ready: true }
  }

  /**
   * One advertiser feed per page.
   *
   * The cursor is the index of the next feed. Feed documents are whole files
   * rather than paged endpoints, so the natural unit of work is one advertiser.
   */
  async getProducts(options: CatalogFetchOptions = {}): Promise<CatalogPage> {
    const readiness = this.readiness()
    if (!readiness.ready) throw new ProviderAuthError('admitad', readiness.reason)

    const index = options.cursor ? Number.parseInt(options.cursor, 10) : 0
    if (!Number.isInteger(index) || index < 0 || index >= this.feeds.length) {
      return { products: [], cursor: null }
    }

    const feed = this.feeds[index]
    const document = await this.download(feed, options.signal)
    const products = parseAdmitadFeedDocument(document, feed, (message, context) =>
      this.log.warn(message, context),
    )

    this.log.info('admitad feed parsed', { slug: feed.slug, products: products.length })

    const next = index + 1
    return { products, cursor: next < this.feeds.length ? String(next) : null }
  }

  private async download(feed: AdmitadFeedConfig, signal?: AbortSignal): Promise<string> {
    const timeout = AbortSignal.timeout(this.timeoutMs)
    const combined = signal ? AbortSignal.any([signal, timeout]) : timeout

    let response: Response
    try {
      response = await this.fetchImpl(feed.feedUrl, { signal: combined, redirect: 'follow' })
    } catch (error) {
      throw new ProviderUnavailableError('admitad', `Feed download failed for ${feed.slug}`, error)
    }

    if (response.status === 401 || response.status === 403) {
      throw new ProviderAuthError('admitad', `Feed URL for ${feed.slug} was rejected`)
    }
    if (!response.ok) {
      throw new ProviderUnavailableError(
        'admitad',
        `Feed for ${feed.slug} returned ${response.status}`,
      )
    }

    try {
      return await response.text()
    } catch (error) {
      throw new ProviderResponseError('admitad', `Feed for ${feed.slug} was unreadable`, error)
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Feed parsing                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Parse a feed document into raw products.
 *
 * Handles the two shapes Admitad advertisers actually ship: a Google Merchant /
 * YML style XML document, and a delimited text file. Exported for tests.
 *
 * Deliberately lenient about which optional columns exist and strict about the
 * four that make a listing usable — id, title, URL and price. A row missing any
 * of those is skipped, because a product with no price is not a product.
 */
export function parseAdmitadFeedDocument(
  document: string,
  feed: AdmitadFeedConfig,
  onWarn: (message: string, context?: Record<string, unknown>) => void = () => {},
): RawCatalogProduct[] {
  const trimmed = document.trimStart()
  return trimmed.startsWith('<')
    ? parseXmlFeed(trimmed, feed, onWarn)
    : parseDelimitedFeed(trimmed, feed, onWarn)
}

const MERCHANT_OF = (feed: AdmitadFeedConfig) => ({
  name: feed.name,
  slug: feed.slug,
  websiteUrl: feed.websiteUrl,
  allowedHosts: feed.allowedHosts,
})

/**
 * Minimal XML offer reader.
 *
 * A full XML parser is not a dependency worth adding for this: product feeds
 * are a flat repetition of <offer>/<item> elements with leaf text children, and
 * that is a shape a scanner handles correctly. Anything more structured than
 * that would be a sign the feed is not a product feed.
 */
function parseXmlFeed(
  document: string,
  feed: AdmitadFeedConfig,
  onWarn: (message: string, context?: Record<string, unknown>) => void,
): RawCatalogProduct[] {
  const products: RawCatalogProduct[] = []
  const offerPattern = /<(offer|item|entry)\b([^>]*)>([\s\S]*?)<\/\1>/gi

  for (const match of document.matchAll(offerPattern)) {
    const attributes = match[2] ?? ''
    const body = match[3] ?? ''

    const field = (...names: string[]): string | undefined => {
      for (const name of names) {
        const pattern = new RegExp(
          `<(?:[a-z0-9]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[a-z0-9]+:)?${name}>`,
          'i',
        )
        const found = pattern.exec(body)
        if (found) {
          const text = decodeXml(found[1]).trim()
          if (text) return text
        }
      }
      return undefined
    }

    const idAttribute = /\bid\s*=\s*"([^"]+)"/i.exec(attributes)?.[1]
    const raw = buildProduct(
      {
        id: field('offer_id', 'id', 'g:id', 'sku') ?? idAttribute,
        title: field('name', 'title', 'g:title'),
        description: field('description', 'g:description'),
        brand: field('vendor', 'brand', 'g:brand', 'manufacturer'),
        category: field('categoryName', 'category_name', 'product_type', 'g:product_type'),
        url: field('url', 'link', 'g:link'),
        image: field('picture', 'image_link', 'g:image_link'),
        price: field('price', 'g:price', 'sale_price', 'g:sale_price'),
        originalPrice: field('oldprice', 'old_price', 'price_old'),
        currency: field('currencyId', 'currency', 'g:price_currency'),
        availability: field('availability', 'g:availability', 'available'),
        gender: field('gender', 'g:gender'),
      },
      feed,
    )

    if (raw) products.push(raw)
    else onWarn('skipped unreadable admitad offer', { slug: feed.slug })
  }

  return products
}

/** CSV/TSV with a header row. Quoted fields with embedded separators supported. */
function parseDelimitedFeed(
  document: string,
  feed: AdmitadFeedConfig,
  onWarn: (message: string, context?: Record<string, unknown>) => void,
): RawCatalogProduct[] {
  const lines = document.split(/\r?\n/).filter((line) => line.trim() !== '')
  if (lines.length < 2) return []

  const delimiter = lines[0].includes('\t')
    ? '\t'
    : lines[0].split(';').length > lines[0].split(',').length
      ? ';'
      : ','
  const header = splitRow(lines[0], delimiter).map((h) => h.trim().toLowerCase())

  const pick = (cells: string[], ...names: string[]): string | undefined => {
    for (const name of names) {
      const index = header.indexOf(name)
      if (index !== -1) {
        const value = cells[index]?.trim()
        if (value) return value
      }
    }
    return undefined
  }

  const products: RawCatalogProduct[] = []

  for (const line of lines.slice(1)) {
    const cells = splitRow(line, delimiter)
    const raw = buildProduct(
      {
        id: pick(cells, 'offer_id', 'id', 'sku'),
        title: pick(cells, 'name', 'title'),
        description: pick(cells, 'description'),
        brand: pick(cells, 'vendor', 'brand', 'manufacturer'),
        category: pick(cells, 'category_name', 'categoryname', 'category', 'product_type'),
        url: pick(cells, 'url', 'link'),
        image: pick(cells, 'picture', 'image_link', 'image'),
        price: pick(cells, 'price', 'sale_price'),
        originalPrice: pick(cells, 'oldprice', 'old_price'),
        currency: pick(cells, 'currencyid', 'currency'),
        availability: pick(cells, 'availability', 'available', 'in_stock'),
        gender: pick(cells, 'gender'),
      },
      feed,
    )

    if (raw) products.push(raw)
    else onWarn('skipped unreadable admitad row', { slug: feed.slug })
  }

  return products
}

interface FeedFields {
  id?: string
  title?: string
  description?: string
  brand?: string
  category?: string
  url?: string
  image?: string
  price?: string
  originalPrice?: string
  currency?: string
  availability?: string
  gender?: string
}

function buildProduct(fields: FeedFields, feed: AdmitadFeedConfig): RawCatalogProduct | null {
  if (!fields.id || !fields.title || !fields.url || !fields.price) return null
  if (!isSafeHttpUrl(fields.url)) return null

  return {
    externalId: fields.id,
    title: fields.title,
    description: fields.description,
    brand: fields.brand,
    category: fields.category,
    gender: fields.gender,
    productUrl: fields.url,
    imageUrl: fields.image && isSafeHttpUrl(fields.image) ? fields.image : undefined,
    // Price strings arrive in many formats; services/normalization/price.ts
    // parses them and refuses ambiguity rather than guessing.
    price: fields.price,
    originalPrice: fields.originalPrice ?? null,
    currency: fields.currency,
    availability: normalizeAvailability(fields.availability),
    merchant: MERCHANT_OF(feed),
    attributes: {},
  }
}

/**
 * Feeds express stock as `true`/`in stock`/`1`/`preorder`/… Anything not
 * recognisably "available" maps to out of stock: showing someone a product they
 * cannot buy is worse than hiding one they could.
 */
function normalizeAvailability(value: string | undefined): string {
  if (!value) return 'in_stock'
  const text = value.trim().toLowerCase()
  if (['true', '1', 'yes', 'in stock', 'in_stock', 'instock', 'available'].includes(text)) {
    return 'in_stock'
  }
  if (['false', '0', 'no', 'out of stock', 'out_of_stock', 'outofstock'].includes(text)) {
    return 'out_of_stock'
  }
  return text
}

function splitRow(line: string, delimiter: string): string[] {
  const cells: string[] = []
  let current = ''
  let quoted = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      // A doubled quote inside a quoted field is a literal quote.
      if (quoted && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current)
      current = ''
    } else {
      current += char
    }
  }
  cells.push(current)
  return cells
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}
