import { describe, expect, it } from 'vitest'
import { DEFAULT_CATALOG_FILTERS, filterRulesFor } from '@/config/catalog-filters'
import { evaluateFilters } from '@/services/ingestion/filter'
import { contentHashFor } from '@/services/ingestion/persist'
import { mapFlipkartProduct } from '@/services/ingestion/providers/flipkart'
import {
  parseAdmitadFeedDocument,
  parseAdmitadFeeds,
  type AdmitadFeedConfig,
} from '@/services/ingestion/providers/admitad'
import { extractTrackingUrl } from '@/services/ingestion/providers/cuelinks'
import { normalizeProduct } from '@/services/normalization/normalize'
import type { NormalizedProduct } from '@/services/normalization/normalize'

/**
 * Provider mapping, filtering and identity.
 *
 * The payload shapes below are constructed from each provider's PUBLISHED
 * documentation — Flipkart's `productInfoList` / `productBaseInfoV1` envelope,
 * Admitad's documented mandatory feed columns. They are not captured responses
 * from a live account; no such account exists for this project. They therefore
 * prove that the adapters read the documented shape correctly, and nothing more
 * than that. The real envelope must still be confirmed before either provider
 * is switched on.
 */

/* -------------------------------------------------------------------------- */
/* Flipkart                                                                    */
/* -------------------------------------------------------------------------- */

const flipkartEntry = {
  productBaseInfoV1: {
    productId: 'TSHEXAMPLE01',
    title: 'Aera Boxy Cotton T-Shirt',
    productBrand: 'Aera',
    productUrl: 'https://www.flipkart.com/aera-boxy-tee/p/itmexample',
    imageUrls: {
      '200x200': 'https://img.example/small.jpg',
      '800x800': 'https://img.example/large.jpg',
      '400x400': 'https://img.example/medium.jpg',
    },
    maximumRetailPrice: { amount: 2499, currency: 'INR' },
    flipkartSellingPrice: { amount: 1499, currency: 'INR' },
    inStock: true,
    categoryPath: [[{ title: 'Clothing' }, { title: 'T-Shirts' }]],
  },
}

describe('flipkart product mapping', () => {
  it('reads the documented v1.1.0 envelope', () => {
    const product = mapFlipkartProduct(flipkartEntry)

    expect(product).not.toBeNull()
    expect(product!.externalId).toBe('TSHEXAMPLE01')
    expect(product!.brand).toBe('Aera')
    expect(product!.price).toBe(1499)
    expect(product!.originalPrice).toBe(2499)
    expect(product!.currency).toBe('INR')
    expect(product!.availability).toBe('in_stock')
    expect(product!.merchant.slug).toBe('flipkart')
    expect(product!.category).toBe('Clothing > T-Shirts')
  })

  it('picks the highest-resolution image rather than the first key', () => {
    const product = mapFlipkartProduct(flipkartEntry)
    expect(product!.imageUrl).toBe('https://img.example/large.jpg')
  })

  it('accepts the deprecated v0.1.0 field names', () => {
    const product = mapFlipkartProduct({
      productBaseInfo: {
        productId: 'OLD1',
        title: 'Legacy listing',
        productUrl: 'https://www.flipkart.com/legacy/p/itmold',
        sellingPrice: { amount: 999, currency: 'INR' },
        inStock: true,
      },
    })
    expect(product?.price).toBe(999)
  })

  it('drops an MRP that is not above the selling price', () => {
    // A "was" price at or below the current price is bad feed data, not a deal.
    const product = mapFlipkartProduct({
      productBaseInfoV1: {
        ...flipkartEntry.productBaseInfoV1,
        maximumRetailPrice: { amount: 1499, currency: 'INR' },
      },
    })
    expect(product?.originalPrice).toBeNull()
  })

  it('refuses entries missing an id, title, url or price', () => {
    expect(mapFlipkartProduct(null)).toBeNull()
    expect(mapFlipkartProduct({ productBaseInfoV1: { productId: 'X' } })).toBeNull()
    expect(
      mapFlipkartProduct({
        productBaseInfoV1: { ...flipkartEntry.productBaseInfoV1, flipkartSellingPrice: null },
      }),
    ).toBeNull()
  })

  it('treats a product not in stock as unavailable rather than assuming it sells', () => {
    const product = mapFlipkartProduct({
      productBaseInfoV1: { ...flipkartEntry.productBaseInfoV1, inStock: false },
    })
    expect(product?.availability).toBe('out_of_stock')
  })
})

/* -------------------------------------------------------------------------- */
/* Admitad                                                                     */
/* -------------------------------------------------------------------------- */

const feed: AdmitadFeedConfig = {
  slug: 'example-store',
  name: 'Example Store',
  websiteUrl: 'https://store.example',
  allowedHosts: ['store.example'],
  feedUrl: 'https://feeds.example/example-store.xml',
}

describe('admitad feed parsing', () => {
  it('reads the documented mandatory columns from a CSV feed', () => {
    const csv = [
      'offer_id,name,url,price,currencyId,vendor,category_name,picture,availability',
      'SKU-1,Merino Crew Knit,https://store.example/p/1,124.00,USD,Harrow,Knitwear,https://img.example/1.jpg,true',
      'SKU-2,Relaxed Chino,https://store.example/p/2,79.00,USD,Calder,Trousers,https://img.example/2.jpg,false',
    ].join('\n')

    const products = parseAdmitadFeedDocument(csv, feed)

    expect(products).toHaveLength(2)
    expect(products[0].externalId).toBe('SKU-1')
    expect(products[0].brand).toBe('Harrow')
    expect(products[0].availability).toBe('in_stock')
    expect(products[0].merchant.slug).toBe('example-store')
    expect(products[1].availability).toBe('out_of_stock')
  })

  it('handles quoted CSV fields containing the delimiter', () => {
    const csv = [
      'offer_id,name,url,price,currencyId',
      'SKU-3,"Shirt, Oxford",https://store.example/p/3,68.00,USD',
    ].join('\n')

    expect(parseAdmitadFeedDocument(csv, feed)[0].title).toBe('Shirt, Oxford')
  })

  it('reads a YML/Google-Merchant style XML feed', () => {
    const xml = `<?xml version="1.0"?>
      <yml_catalog><shop><offers>
        <offer id="A1">
          <name><![CDATA[Canvas Weekend Tote]]></name>
          <url>https://store.example/p/tote</url>
          <price>142.00</price>
          <currencyId>USD</currencyId>
          <vendor>Ashby</vendor>
          <categoryName>Bags</categoryName>
          <picture>https://img.example/tote.jpg</picture>
        </offer>
      </offers></shop></yml_catalog>`

    const products = parseAdmitadFeedDocument(xml, feed)

    expect(products).toHaveLength(1)
    expect(products[0].externalId).toBe('A1')
    expect(products[0].title).toBe('Canvas Weekend Tote')
    expect(products[0].brand).toBe('Ashby')
  })

  it('skips rows missing a price or a URL instead of inventing one', () => {
    const csv = [
      'offer_id,name,url,price,currencyId',
      'SKU-4,No price here,https://store.example/p/4,,USD',
      'SKU-5,No url here,,50.00,USD',
      'SKU-6,Fine,https://store.example/p/6,50.00,USD',
    ].join('\n')

    const products = parseAdmitadFeedDocument(csv, feed)
    expect(products.map((p) => p.externalId)).toEqual(['SKU-6'])
  })

  it('refuses a non-http product URL', () => {
    const csv = [
      'offer_id,name,url,price,currencyId',
      'SKU-7,Bad scheme,javascript:alert(1),50.00,USD',
    ].join('\n')

    expect(parseAdmitadFeedDocument(csv, feed)).toHaveLength(0)
  })

  it('skips malformed ADMITAD_FEEDS entries without discarding the good ones', () => {
    const parsed = parseAdmitadFeeds(
      'good|Good Store|https://good.example|good.example|https://feeds.example/good.xml;' +
        'broken-entry-with-no-pipes;' +
        'bad|Bad Store|ftp://nope.example|x|https://feeds.example/bad.xml',
    )
    expect(parsed.map((f) => f.slug)).toEqual(['good'])
  })
})

/* -------------------------------------------------------------------------- */
/* Cuelinks                                                                    */
/* -------------------------------------------------------------------------- */

describe('cuelinks response reading', () => {
  it('finds the tracking url at the top level or nested', () => {
    expect(extractTrackingUrl({ tracking_url: 'https://linksredirect.com/?a=1' })).toBe(
      'https://linksredirect.com/?a=1',
    )
    expect(extractTrackingUrl({ data: { url: 'https://linksredirect.com/?a=2' } })).toBe(
      'https://linksredirect.com/?a=2',
    )
    expect(extractTrackingUrl({ nothing: true })).toBeNull()
    expect(extractTrackingUrl(null)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Filtering                                                                   */
/* -------------------------------------------------------------------------- */

function normalized(overrides: Partial<NormalizedProduct> = {}): NormalizedProduct {
  const outcome = normalizeProduct({
    externalId: 'X1',
    title: 'Boxy Cotton T-Shirt',
    brand: 'Aera',
    category: 'Clothing',
    price: 68,
    currency: 'USD',
    productUrl: 'https://store.example/p/1',
    imageUrl: 'https://img.example/1.jpg',
    availability: 'in_stock',
  })
  if (!outcome.ok) throw new Error(`fixture failed to normalize: ${outcome.errors.join(', ')}`)
  return { ...outcome.value, ...overrides }
}

describe('catalogue filtering', () => {
  const rules = DEFAULT_CATALOG_FILTERS

  it('accepts a product inside every rule', () => {
    expect(evaluateFilters(normalized(), rules).accepted).toBe(true)
  })

  it('refuses a category that is not stocked in phase 1', () => {
    const decision = evaluateFilters(normalized({ category: 'electronics' }), rules)
    expect(decision).toMatchObject({ accepted: false, reason: 'category_not_allowed' })
  })

  it('applies the price band', () => {
    const product = normalized()
    const cheap = { ...product, listing: { ...product.listing, currentPrice: 3 } }
    const dear = { ...product, listing: { ...product.listing, currentPrice: 9999 } }

    expect(evaluateFilters(cheap, rules)).toMatchObject({ reason: 'below_min_price' })
    expect(evaluateFilters(dear, rules)).toMatchObject({ reason: 'above_max_price' })
  })

  it('matches brand rules case-insensitively', () => {
    // Feeds are inconsistent about capitalisation; an allowlist that misses
    // "AERA" because it was written "Aera" is a silently empty catalogue.
    const allow = { ...rules, allowedBrands: ['aera'] }
    expect(evaluateFilters(normalized(), allow).accepted).toBe(true)

    const deny = { ...rules, excludedBrands: ['AERA'] }
    expect(evaluateFilters(normalized(), deny)).toMatchObject({ reason: 'brand_excluded' })
  })

  it('lets the exclude list win over the allow list', () => {
    const conflicting = { ...rules, allowedBrands: ['Aera'], excludedBrands: ['Aera'] }
    expect(evaluateFilters(normalized(), conflicting)).toMatchObject({ reason: 'brand_excluded' })
  })

  it('refuses listings with no image or no stock when required', () => {
    const product = normalized()
    const noImage = { ...product, listing: { ...product.listing, imageUrl: null } }
    const noStock = {
      ...product,
      listing: { ...product.listing, availability: 'out_of_stock' as const },
    }

    expect(evaluateFilters(noImage, rules)).toMatchObject({ reason: 'missing_image' })
    expect(evaluateFilters(noStock, rules)).toMatchObject({ reason: 'not_in_stock' })
  })

  it('does not filter out products whose gender could not be mapped', () => {
    // The normalizer returns null rather than guessing; refusing those would
    // discard most unisex stock.
    const rulesWithGender = { ...rules, allowedGenders: ['women'] }
    expect(evaluateFilters(normalized({ gender: null }), rulesWithGender).accepted).toBe(true)
  })

  it('exempts the seed provider from the production catalogue gate', () => {
    const seedRules = filterRulesFor('seed')
    expect(seedRules.allowedCategories).toEqual([])
    expect(seedRules.minPrice).toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/* Content hashing                                                             */
/* -------------------------------------------------------------------------- */

describe('listing content hash', () => {
  it('is stable for identical content and changes when the price moves', () => {
    const a = normalized()
    const b = normalized()
    expect(contentHashFor(a)).toBe(contentHashFor(b))

    const repriced = { ...a, listing: { ...a.listing, currentPrice: 59 } }
    expect(contentHashFor(repriced)).not.toBe(contentHashFor(a))
  })
})
