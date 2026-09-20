import { createHash } from 'node:crypto'
import type { Db } from '@/lib/db/types'
import type { MerchantDescriptor } from '@/lib/merchants/provider'
import type { NormalizedProduct } from '@/services/normalization/normalize'

/**
 * Writing a normalised product into the catalogue.
 *
 * Extracted from pipeline.ts so the seed path and the real-provider path share
 * one implementation. There must be exactly one place that decides how a
 * product becomes rows — two would drift, and the difference would show up as
 * real listings behaving subtly unlike the ones every test exercises.
 *
 * Everything upserts on a natural key, so a re-run is idempotent.
 */

export type PersistOutcome = 'inserted' | 'updated' | 'unchanged'

export interface PersistResult {
  listingId: string
  productId: string
  outcome: PersistOutcome
  priceObservations: number
}

export interface PersistOptions {
  /** Which adapter produced this. Part of listing identity. */
  provider?: string
  /** Backfill historical prices. Seed provider only — never for real feeds. */
  backfillHistory?: (externalId: string) => Array<{ price: number; recordedAt: Date }>
  /** Timestamp recorded for the current price observation. */
  now?: Date
  /** The network's own offer id, when distinct from the merchant's product id. */
  externalListingId?: string | null
  /** A trackable URL, when the provider mints a durable one. */
  affiliateUrl?: string | null
}

export async function upsertMerchant(db: Db, descriptor: MerchantDescriptor): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into merchants (name, slug, website_url, logo_url, allowed_hosts, status)
     values ($1, $2, $3, $4, $5, 'active')
     on conflict (slug) do update
       set name = excluded.name,
           website_url = excluded.website_url,
           logo_url = excluded.logo_url,
           allowed_hosts = excluded.allowed_hosts
     returning id`,
    [
      descriptor.name,
      descriptor.slug,
      descriptor.websiteUrl,
      descriptor.logoUrl ?? null,
      descriptor.allowedHosts,
    ],
  )
  return rows[0].id
}

/**
 * A stable fingerprint of everything we persist about a listing.
 *
 * Lets a re-run recognise an untouched listing and skip it. Deliberately
 * excludes timestamps and ids: hashing those would make every run a change and
 * defeat the purpose.
 */
export function contentHashFor(product: NormalizedProduct): string {
  const listing = product.listing
  const payload = JSON.stringify([
    product.canonicalTitle,
    product.description,
    product.brand,
    product.category,
    product.subcategory,
    product.gender,
    product.attributes,
    listing.title,
    listing.productUrl,
    listing.imageUrl,
    listing.availability,
    listing.currentPrice,
    listing.originalPrice,
    listing.currency,
    product.images,
    product.variants,
  ])
  return createHash('sha256').update(payload).digest('hex').slice(0, 32)
}

export async function persistProduct(
  db: Db,
  merchantId: string,
  product: NormalizedProduct,
  options: PersistOptions = {},
): Promise<PersistResult> {
  const provider = options.provider ?? 'seed'
  const hash = contentHashFor(product)

  return db.transaction(async (tx) => {
    // --- Canonical product ---------------------------------------------------
    // On conflict the existing canonical record wins for fields it already has:
    // a second merchant listing the same product may fill in gaps but must not
    // overwrite what the first one established.
    const productRows = await tx.query<{ id: string }>(
      `insert into products
         (canonical_title, description, brand, category, subcategory, gender, attributes, keywords, match_key)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       on conflict (match_key) do update
         set description = coalesce(products.description, excluded.description),
             subcategory = coalesce(products.subcategory, excluded.subcategory),
             gender      = coalesce(products.gender, excluded.gender),
             attributes  = products.attributes || excluded.attributes,
             keywords    = case
                             when length(excluded.keywords) > length(products.keywords)
                             then excluded.keywords else products.keywords
                           end,
             updated_at  = now()
       returning id`,
      [
        product.canonicalTitle,
        product.description,
        product.brand,
        product.category,
        product.subcategory,
        product.gender,
        JSON.stringify(product.attributes),
        product.keywords,
        product.matchKey,
      ],
    )
    const productId = productRows[0].id

    // --- Variants ------------------------------------------------------------
    for (const variant of product.variants) {
      await tx.query(
        `insert into product_variants (product_id, sku, size, color, variant_attributes)
         values ($1, $2, $3, $4, $5::jsonb)
         on conflict (product_id, coalesce(size, ''), coalesce(color, ''))
         do update set sku = coalesce(excluded.sku, product_variants.sku),
                       variant_attributes = excluded.variant_attributes,
                       updated_at = now()`,
        [
          productId,
          variant.sku,
          variant.size,
          variant.color,
          JSON.stringify(variant.variantAttributes),
        ],
      )
    }

    // --- Merchant listing ----------------------------------------------------
    const listing = product.listing

    // `xmax = 0` is true only for a freshly inserted row, so one statement
    // reports whether this was an insert or an update without a prior SELECT.
    const listingRows = await tx.query<{
      id: string
      inserted: boolean
      previous_hash: string | null
    }>(
      `insert into merchant_products
         (merchant_id, product_id, provider, external_product_id, external_listing_id,
          title, product_url, affiliate_url, image_url, availability,
          current_price, original_price, currency, metadata, content_hash, last_synced_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, now())
       on conflict (merchant_id, provider, external_product_id) do update
         set product_id          = excluded.product_id,
             external_listing_id = excluded.external_listing_id,
             title               = excluded.title,
             product_url         = excluded.product_url,
             affiliate_url       = excluded.affiliate_url,
             image_url           = excluded.image_url,
             availability        = excluded.availability,
             current_price       = excluded.current_price,
             original_price      = excluded.original_price,
             currency            = excluded.currency,
             content_hash        = excluded.content_hash,
             last_synced_at      = now(),
             updated_at          = now()
       returning id, (xmax = 0) as inserted,
                 (select content_hash from merchant_products existing
                   where existing.merchant_id = $1
                     and existing.provider = $3
                     and existing.external_product_id = $4) as previous_hash`,
      [
        merchantId,
        productId,
        provider,
        listing.externalProductId,
        options.externalListingId ?? null,
        listing.title,
        listing.productUrl,
        // Most networks mint affiliate URLs per click (they embed a click id),
        // so nothing durable is stored unless the provider supplies one.
        options.affiliateUrl ?? null,
        listing.imageUrl,
        listing.availability,
        listing.currentPrice,
        listing.originalPrice,
        listing.currency,
        JSON.stringify({ matchStrategy: product.matchStrategy, provider }),
        hash,
      ],
    )
    const listingId = listingRows[0].id
    const wasInserted = listingRows[0].inserted === true
    // `previous_hash` is read inside the same statement, so it is the value
    // from before this upsert wrote over it.
    const unchanged = !wasInserted && listingRows[0].previous_hash === hash

    // --- Images --------------------------------------------------------------
    for (const [index, url] of product.images.entries()) {
      await tx.query(
        `insert into product_images (product_id, merchant_product_id, url, alt_text, position)
         select $1, $2, $3, $4, $5
         where not exists (
           select 1 from product_images
           where merchant_product_id = $2 and url = $3
         )`,
        [productId, listingId, url, `${product.brand} ${product.canonicalTitle}`, index],
      )
    }

    // --- Price history -------------------------------------------------------
    const priceObservations = await recordPrice(tx, listingId, product, options)

    return {
      listingId,
      productId,
      outcome: wasInserted ? 'inserted' : unchanged ? 'unchanged' : 'updated',
      priceObservations,
    }
  })
}

/**
 * Price observations.
 *
 * Two mutually exclusive modes, and the distinction matters more than anything
 * else in this file:
 *
 *   backfill — synthetic history for the seed catalogue, written `source='seed'`
 *              and only ever once per listing.
 *   observe  — a real observation of a real price, written `source='sync'`.
 *
 * Nothing here manufactures history for a real feed. A provider that supplies
 * only a current price produces exactly one observation per run, and the deal
 * engine is left to report thin evidence honestly until enough runs accumulate.
 */
async function recordPrice(
  tx: Db,
  listingId: string,
  product: NormalizedProduct,
  options: PersistOptions,
): Promise<number> {
  const listing = product.listing
  const backfill = options.backfillHistory?.(listing.externalProductId) ?? []

  if (backfill.length > 0) {
    const existing = await tx.query<{ n: number }>(
      `select count(*)::int as n from price_history where merchant_product_id = $1`,
      [listingId],
    )
    // Only backfill once. Re-running ingestion must not multiply history.
    if ((existing[0]?.n ?? 0) > 0) return 0

    // One multi-row INSERT rather than a statement per observation: a backfill
    // is ~30 rows per listing, and round-tripping each separately is both slow
    // and needlessly heavy on the connection.
    const values: unknown[] = [listingId, listing.currency]
    const tuples = backfill.map((point) => {
      values.push(point.price, point.recordedAt.toISOString())
      return `($1, $${values.length - 1}, $2, $${values.length}, 'seed')`
    })

    await tx.query(
      `insert into price_history (merchant_product_id, price, currency, recorded_at, source)
       values ${tuples.join(', ')}`,
      values,
    )
    return backfill.length
  }

  // Normal operation: record the observation we just made, but only when the
  // price actually changed, so history stays a change log rather than a poll log.
  const inserted = await tx.query<{ id: string }>(
    `insert into price_history (merchant_product_id, price, original_price, currency, recorded_at, source)
     select $1, $2, $3, $4, $5, 'sync'
     where not exists (
       select 1 from price_history
       where merchant_product_id = $1
         and price = $2
         and recorded_at = (
           select max(recorded_at) from price_history where merchant_product_id = $1
         )
     )
     returning id`,
    [
      listingId,
      listing.currentPrice,
      listing.originalPrice,
      listing.currency,
      (options.now ?? new Date()).toISOString(),
    ],
  )

  return inserted.length
}
