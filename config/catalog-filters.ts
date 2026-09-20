import type { ProviderId } from '@/lib/providers/types'

/**
 * What LivinUp is willing to put in its catalogue.
 *
 * Phase 1 of real ingestion is deliberately small — roughly 500–2,000 good
 * listings, not a mirror of an affiliate network. These rules are the gate, and
 * they live here as data so that tightening the catalogue is a config edit
 * reviewed in one place, rather than a condition added to whichever file
 * happened to be open.
 *
 * Brand lists are intentionally EMPTY. Which premium brands are actually
 * reachable depends on the advertiser programmes each account is approved for,
 * and that is not known yet. Guessing now would bake in a list that has to be
 * unpicked later; an empty allowlist means "no brand restriction", and the
 * moment the approved programmes are known the names go in `allowedBrands`.
 */

export interface CatalogFilterRules {
  /**
   * Canonical categories (config/taxonomy.ts) allowed into the catalogue.
   * Empty means no category restriction.
   */
  allowedCategories: string[]
  /** Canonical categories always refused, even if allowed above. */
  excludedCategories: string[]

  /** Brand names allowed, compared case-insensitively. Empty means no restriction. */
  allowedBrands: string[]
  /** Brand names always refused. Wins over `allowedBrands`. */
  excludedBrands: string[]

  /**
   * Price band, in the listing's own currency, in major units.
   *
   * A floor is a quality signal as much as a price one: on a general affiliate
   * feed the sub-£10 tail is overwhelmingly accessories, phone cases and
   * unbranded filler, none of which suits a personalised discovery feed.
   */
  minPrice: number | null
  maxPrice: number | null

  /** Currencies accepted. Empty means any currency the normalizer recognises. */
  allowedCurrencies: string[]

  /** Genders allowed (config/taxonomy.ts). Empty means no restriction. */
  allowedGenders: string[]

  /** Refuse listings with no usable image. */
  requireImage: boolean

  /** Refuse listings the provider reports as not buyable. */
  requireInStock: boolean

  /**
   * Hard ceiling on how many listings one run may accept.
   *
   * The point of Phase 1 is a small, good catalogue. This is the backstop that
   * keeps a mis-scoped feed from turning into 400,000 rows overnight.
   */
  maxAcceptedPerRun: number
}

/** Applied to every provider unless a provider-specific rule overrides it. */
export const DEFAULT_CATALOG_FILTERS: CatalogFilterRules = {
  // Phase 1 is a fashion-led catalogue. `home` and `electronics` exist in the
  // taxonomy and are deliberately not ingested yet.
  allowedCategories: ['clothing', 'shoes', 'accessories'],
  excludedCategories: [],

  // Deliberately empty — see the note at the top of this file.
  allowedBrands: [],
  excludedBrands: [],

  minPrice: 15,
  maxPrice: 2000,

  allowedCurrencies: [],
  allowedGenders: [],

  requireImage: true,
  requireInStock: true,

  maxAcceptedPerRun: 2000,
}

/**
 * Per-provider overrides, merged over the defaults.
 *
 * Empty today. It exists because provider-specific rules are inevitable — one
 * network's feed will carry a category the others do not, or a marketplace will
 * need a tighter floor than a single-brand advertiser — and the alternative is
 * those rules appearing inline in adapters.
 */
export const PROVIDER_CATALOG_FILTERS: Partial<Record<ProviderId, Partial<CatalogFilterRules>>> = {
  // The seed catalogue is development data and deliberately bypasses the
  // production gate; it is ingested by the separate seed pipeline in any case.
  seed: {
    allowedCategories: [],
    minPrice: null,
    maxPrice: null,
    requireImage: false,
    requireInStock: false,
  },
}

export function filterRulesFor(provider: ProviderId): CatalogFilterRules {
  return { ...DEFAULT_CATALOG_FILTERS, ...(PROVIDER_CATALOG_FILTERS[provider] ?? {}) }
}
