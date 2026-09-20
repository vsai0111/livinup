import type {
  AffiliateContext,
  MerchantDescriptor,
  RawMerchantProduct,
} from '@/lib/merchants/provider'

/**
 * The provider seam for real affiliate data.
 *
 * Phase 1 modelled one source as one merchant (`MerchantProvider`), which is
 * the right shape for a direct merchant API and the wrong shape for an
 * affiliate network, where a single credential fronts hundreds of advertisers.
 * So there are two interfaces here, split along what these services actually
 * are rather than along what we wish they were:
 *
 *   CatalogProvider   supplies products, each attributed to its own merchant
 *   DeeplinkProvider  turns a product URL into a tracked affiliate URL
 *
 * A provider may implement either or both. That distinction is not academic —
 * of the three networks under evaluation, Cuelinks publishes no product
 * catalogue at all (campaigns, link conversion and conversion reporting only),
 * so modelling it as a source of products would have meant building an adapter
 * for an endpoint that does not exist. See docs/product-data.md.
 *
 * Providers stay dumb: they fetch, they shape, and they stop. Normalisation,
 * filtering, identity and persistence all happen downstream, exactly as they
 * already do for the seed provider.
 */

/** Stable provider keys. Used in config, env var names and `merchant_products.provider`. */
export const PROVIDER_IDS = ['seed', 'flipkart', 'admitad', 'cuelinks'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export function isProviderId(value: unknown): value is ProviderId {
  return typeof value === 'string' && (PROVIDER_IDS as readonly string[]).includes(value)
}

/**
 * A raw product from a network, carrying the merchant it belongs to.
 *
 * Extends the existing raw shape rather than replacing it, so the normalizer,
 * matcher and persistence layer are shared with the seed pipeline and there is
 * exactly one definition of "a product before LivinUp touched it".
 */
export interface RawCatalogProduct extends RawMerchantProduct {
  /** The advertiser/retailer actually selling this. Networks front many. */
  merchant: MerchantDescriptor
  /** The network's own offer id, when distinct from the merchant's product id. */
  externalListingId?: string
}

export interface CatalogPage {
  products: RawCatalogProduct[]
  /** Opaque cursor for the next page, or null when the feed is exhausted. */
  cursor: string | null
}

export interface CatalogFetchOptions {
  cursor?: string | null
  /** Soft cap on products per page, where the provider supports one. */
  limit?: number
  /** Only products changed since this time, where the provider supports it. */
  updatedSince?: Date
  /** Abort signal so a scheduled run can enforce its own wall clock. */
  signal?: AbortSignal
}

export interface CatalogProvider {
  readonly id: ProviderId

  /**
   * Whether this provider can run right now.
   *
   * Credentials live in the environment and are frequently absent — that is the
   * normal state of an integration awaiting account approval, not an error. The
   * runner reports `reason` and skips, rather than throwing.
   */
  readiness(): ProviderReadiness

  /** Page through the provider's catalogue. */
  getProducts(options?: CatalogFetchOptions): Promise<CatalogPage>
}

export interface DeeplinkProvider {
  readonly id: ProviderId
  readiness(): ProviderReadiness

  /**
   * Wrap a destination URL in this network's tracking.
   *
   * Returns null when the provider cannot produce one for this URL (an
   * unaffiliated merchant, typically). The caller then sends the user to the
   * plain product URL and records the click for LivinUp's own analytics — a
   * missing commission is not a reason to break the link.
   */
  createDeeplink(destinationUrl: string, context: AffiliateContext): Promise<string | null>
}

export type ProviderReadiness =
  | { ready: true }
  | {
      ready: false
      /** Human-readable, safe to log and to print in the CLI. Never contains secrets. */
      reason: string
      /** Env vars that would make this provider ready. Names only, never values. */
      missing: string[]
    }

/* -------------------------------------------------------------------------- */
/* Errors                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Typed provider failures.
 *
 * The runner treats these differently: a rate limit or an outage should end the
 * run cleanly and leave the existing catalogue untouched, while a malformed
 * product should be counted and skipped. Distinguishing them by class keeps
 * that decision out of string matching on error messages.
 */
export class ProviderError extends Error {
  constructor(
    readonly provider: ProviderId,
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}

/** Credentials absent, rejected, or expired. Never include the credential itself. */
export class ProviderAuthError extends ProviderError {
  readonly name = 'ProviderAuthError'
}

/** Provider asked us to slow down. `retryAfterSeconds` when it said how long. */
export class ProviderRateLimitError extends ProviderError {
  constructor(
    provider: ProviderId,
    message: string,
    readonly retryAfterSeconds?: number,
    cause?: unknown,
  ) {
    super(provider, message, cause)
  }
  readonly name = 'ProviderRateLimitError'
}

/** Network failure, timeout, or a 5xx from the provider. */
export class ProviderUnavailableError extends ProviderError {
  readonly name = 'ProviderUnavailableError'
}

/** The provider answered, but not with anything we can parse. */
export class ProviderResponseError extends ProviderError {
  readonly name = 'ProviderResponseError'
}
