import type { CatalogFilterRules } from '@/config/catalog-filters'
import type { NormalizedProduct } from '@/services/normalization/normalize'

/**
 * The catalogue gate.
 *
 * Runs after normalisation and before persistence, on the normalised product —
 * so it compares against LivinUp's own vocabulary rather than whatever the
 * provider called things. Filtering raw feed categories would mean writing the
 * rules once per provider.
 *
 * A pure function of (product, rules): no database, no environment, no clock.
 * That is what makes the catalogue policy testable as data.
 *
 * "Filtered" is not "rejected". A rejected product is broken; a filtered one is
 * perfectly good and simply not what LivinUp is stocking. The run summary counts
 * them separately because they mean completely different things about a feed.
 */

export type FilterDecision =
  { accepted: true } | { accepted: false; reason: FilterReason; detail?: string }

export type FilterReason =
  | 'category_not_allowed'
  | 'category_excluded'
  | 'brand_not_allowed'
  | 'brand_excluded'
  | 'below_min_price'
  | 'above_max_price'
  | 'currency_not_allowed'
  | 'gender_not_allowed'
  | 'missing_image'
  | 'not_in_stock'
  | 'run_limit_reached'

const BUYABLE = new Set(['in_stock', 'low_stock'])

export function evaluateFilters(
  product: NormalizedProduct,
  rules: CatalogFilterRules,
): FilterDecision {
  const { listing } = product

  // --- Category ------------------------------------------------------------
  if (rules.excludedCategories.includes(product.category)) {
    return { accepted: false, reason: 'category_excluded', detail: product.category }
  }
  if (rules.allowedCategories.length > 0 && !rules.allowedCategories.includes(product.category)) {
    return { accepted: false, reason: 'category_not_allowed', detail: product.category }
  }

  // --- Brand ---------------------------------------------------------------
  // Case-insensitive: feeds are inconsistent about capitalising brand names,
  // and an allowlist that misses "AERA" because it was written "Aera" is a
  // silently empty catalogue.
  const brand = product.brand.trim().toLowerCase()
  if (rules.excludedBrands.some((b) => b.trim().toLowerCase() === brand)) {
    return { accepted: false, reason: 'brand_excluded', detail: product.brand }
  }
  if (
    rules.allowedBrands.length > 0 &&
    !rules.allowedBrands.some((b) => b.trim().toLowerCase() === brand)
  ) {
    return { accepted: false, reason: 'brand_not_allowed', detail: product.brand }
  }

  // --- Price ---------------------------------------------------------------
  if (rules.minPrice !== null && listing.currentPrice < rules.minPrice) {
    return { accepted: false, reason: 'below_min_price', detail: String(listing.currentPrice) }
  }
  if (rules.maxPrice !== null && listing.currentPrice > rules.maxPrice) {
    return { accepted: false, reason: 'above_max_price', detail: String(listing.currentPrice) }
  }

  // --- Currency ------------------------------------------------------------
  if (
    rules.allowedCurrencies.length > 0 &&
    !rules.allowedCurrencies.includes(listing.currency.toUpperCase())
  ) {
    return { accepted: false, reason: 'currency_not_allowed', detail: listing.currency }
  }

  // --- Gender --------------------------------------------------------------
  // An unknown gender is not a failure: the normalizer returns null when it
  // cannot map one, and refusing those would discard most unisex stock.
  if (
    rules.allowedGenders.length > 0 &&
    product.gender !== null &&
    !rules.allowedGenders.includes(product.gender)
  ) {
    return { accepted: false, reason: 'gender_not_allowed', detail: product.gender }
  }

  // --- Presentation --------------------------------------------------------
  if (rules.requireImage && !listing.imageUrl) {
    return { accepted: false, reason: 'missing_image' }
  }
  if (rules.requireInStock && !BUYABLE.has(listing.availability)) {
    return { accepted: false, reason: 'not_in_stock', detail: listing.availability }
  }

  return { accepted: true }
}
