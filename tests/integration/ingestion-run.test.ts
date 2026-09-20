import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  CatalogFetchOptions,
  CatalogPage,
  CatalogProvider,
  ProviderReadiness,
  RawCatalogProduct,
} from '@/lib/providers/types'
import { ProviderUnavailableError } from '@/lib/providers/types'
import { runCatalogIngestion } from '@/services/ingestion/catalog-run'
import { DEFAULT_CATALOG_FILTERS } from '@/config/catalog-filters'
import { createTestDb, type TestDb } from '../helpers/db'

/**
 * The real-provider ingestion run, against real PostgreSQL.
 *
 * Uses a stub provider rather than a live network: the point is the pipeline —
 * canonicalisation, duplicate handling, insert/update detection and price
 * observation — not any provider's HTTP behaviour, which is covered by the
 * mapping tests.
 */

const MERCHANT_A = {
  name: 'Two Rivers',
  slug: 'two-rivers',
  websiteUrl: 'https://tworivers.example',
  allowedHosts: ['tworivers.example'],
}

const MERCHANT_B = {
  name: 'Fieldhouse',
  slug: 'fieldhouse',
  websiteUrl: 'https://fieldhouse.example',
  allowedHosts: ['fieldhouse.example'],
}

function product(overrides: Partial<RawCatalogProduct> = {}): RawCatalogProduct {
  return {
    externalId: 'SKU-1',
    title: 'Boxy Cotton T-Shirt',
    brand: 'Aera',
    category: 'Clothing',
    price: 68,
    currency: 'USD',
    productUrl: 'https://tworivers.example/p/1',
    imageUrl: 'https://img.example/1.jpg',
    availability: 'in_stock',
    merchant: MERCHANT_A,
    ...overrides,
  }
}

class StubProvider implements CatalogProvider {
  readonly id = 'flipkart' as const
  constructor(
    private readonly pages: RawCatalogProduct[][],
    private readonly failOnPage?: number,
  ) {}

  readiness(): ProviderReadiness {
    return { ready: true }
  }

  async getProducts(options: CatalogFetchOptions = {}): Promise<CatalogPage> {
    const index = options.cursor ? Number(options.cursor) : 0
    if (this.failOnPage === index) {
      throw new ProviderUnavailableError('flipkart', 'stub outage')
    }
    const next = index + 1
    return {
      products: this.pages[index] ?? [],
      cursor: next < this.pages.length ? String(next) : null,
    }
  }
}

// The seed gate is bypassed for these fixtures; we are testing the pipeline,
// not the phase-1 catalogue policy (which has its own unit tests).
const RULES = { ...DEFAULT_CATALOG_FILTERS, minPrice: null, maxPrice: null }

describe('real-provider ingestion run', () => {
  let context: TestDb

  beforeAll(async () => {
    context = await createTestDb({ seed: false })
  }, 120_000)

  afterAll(async () => {
    await context?.close()
  })

  it('inserts, then reports the same product as unchanged on a re-run', async () => {
    const provider = new StubProvider([[product()]])

    const first = await runCatalogIngestion(context.db, provider, { rules: RULES })
    expect(first.status).toBe('completed')
    expect(first.inserted).toBe(1)
    expect(first.priceObservations).toBe(1)

    const second = await runCatalogIngestion(context.db, new StubProvider([[product()]]), {
      rules: RULES,
    })
    // Idempotent: nothing about the listing changed, so nothing is rewritten
    // and no second price observation is recorded for the same price.
    expect(second.inserted).toBe(0)
    expect(second.unchanged).toBe(1)
    expect(second.priceObservations).toBe(0)
  })

  it('records a new observation when the price actually moves', async () => {
    await runCatalogIngestion(
      context.db,
      new StubProvider([[product({ externalId: 'SKU-PRICE', price: 100 })]]),
      { rules: RULES },
    )
    const moved = await runCatalogIngestion(
      context.db,
      new StubProvider([[product({ externalId: 'SKU-PRICE', price: 80 })]]),
      { rules: RULES },
    )

    expect(moved.updated).toBe(1)
    expect(moved.priceObservations).toBe(1)

    const history = await context.db.query<{ n: number }>(
      `select count(*)::int as n
         from price_history ph
         join merchant_products mp on mp.id = ph.merchant_product_id
        where mp.external_product_id = 'SKU-PRICE'`,
    )
    expect(history[0].n).toBe(2)
  })

  it('writes real observations as source=sync, never as seed', async () => {
    // The distinction is what keeps synthetic history separable forever.
    const rows = await context.db.query<{ source: string }>(
      `select distinct ph.source
         from price_history ph
         join merchant_products mp on mp.id = ph.merchant_product_id
        where mp.provider = 'flipkart'`,
    )
    expect(rows.map((r) => r.source)).toEqual(['sync'])
  })

  it('collapses two merchants selling the same product onto one canonical product', async () => {
    const shared = { title: 'Merino Crew Knit', brand: 'Harrow', category: 'Clothing' }
    await runCatalogIngestion(
      context.db,
      new StubProvider([
        [
          product({ ...shared, externalId: 'TR-KNIT', merchant: MERCHANT_A, price: 124 }),
          product({
            ...shared,
            externalId: 'FH-KNIT',
            merchant: MERCHANT_B,
            productUrl: 'https://fieldhouse.example/p/knit',
            price: 118,
          }),
        ],
      ]),
      { rules: RULES },
    )

    const rows = await context.db.query<{ listings: number }>(
      `select count(mp.id)::int as listings
         from products p
         join merchant_products mp on mp.product_id = p.id
        where p.canonical_title ilike '%merino%'
        group by p.id`,
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].listings).toBe(2)
  })

  it('counts a repeated offer in one feed as a duplicate rather than ingesting it twice', async () => {
    const summary = await runCatalogIngestion(
      context.db,
      new StubProvider([
        [
          product({ externalId: 'SKU-DUP', title: 'Canvas Tote', brand: 'Ashby' }),
          product({ externalId: 'SKU-DUP', title: 'Canvas Tote', brand: 'Ashby' }),
        ],
      ]),
      { rules: RULES },
    )

    expect(summary.duplicates).toBe(1)
    expect(summary.inserted).toBe(1)
  })

  it('counts a broken product without aborting the run', async () => {
    const summary = await runCatalogIngestion(
      context.db,
      new StubProvider([
        [
          // No price: the normalizer refuses it. A fabricated price is the
          // worst possible error, so rejection is the only correct outcome.
          product({ externalId: 'BROKEN', price: '' as unknown as number }),
          product({ externalId: 'GOOD', title: 'Suede Loafer', brand: 'Tenby', price: 197 }),
        ],
      ]),
      { rules: RULES },
    )

    expect(summary.rejected).toBe(1)
    expect(summary.inserted).toBe(1)
    expect(summary.rejectionSamples[0].externalId).toBe('BROKEN')
  })

  it('separates filtered from rejected', async () => {
    const summary = await runCatalogIngestion(
      context.db,
      new StubProvider([
        [product({ externalId: 'CHEAP', title: 'Keyring', brand: 'Ashby', price: 2 })],
      ]),
      { rules: { ...DEFAULT_CATALOG_FILTERS, minPrice: 15 } },
    )

    // A filtered product is perfectly good and simply not what LivinUp stocks;
    // a rejected one is broken. Conflating them hides feed quality problems.
    expect(summary.filtered).toBe(1)
    expect(summary.rejected).toBe(0)
    expect(summary.filterBreakdown.below_min_price).toBe(1)
  })

  it('writes nothing in a dry run', async () => {
    const before = await countListings(context)
    const summary = await runCatalogIngestion(
      context.db,
      new StubProvider([[product({ externalId: 'DRY', title: 'Wool Overcoat', brand: 'Voss' })]]),
      { rules: RULES, dryRun: true },
    )

    expect(summary.accepted).toBe(1)
    expect(summary.inserted).toBe(0)
    expect(await countListings(context)).toBe(before)
  })

  it('leaves the catalogue intact when the provider fails mid-run', async () => {
    const before = await countListings(context)
    const summary = await runCatalogIngestion(
      context.db,
      new StubProvider(
        [[product({ externalId: 'P1', title: 'Linen Duvet', brand: 'Öland' })], []],
        1,
      ),
      { rules: RULES },
    )

    expect(summary.status).toBe('failed')
    expect(summary.error).toBe('provider unavailable')
    // The first page still landed, and crucially nothing was deleted: a
    // provider outage is not evidence about the products we already have.
    expect(await countListings(context)).toBeGreaterThanOrEqual(before)
  })

  it('records every run, including one that never started', async () => {
    const summary = await runCatalogIngestion(
      context.db,
      {
        id: 'admitad',
        readiness: () => ({ ready: false, reason: 'not configured', missing: ['ADMITAD_FEEDS'] }),
        getProducts: async () => ({ products: [], cursor: null }),
      },
      { rules: RULES },
    )

    expect(summary.status).toBe('failed')
    const rows = await context.db.query<{ n: number }>(
      `select count(*)::int as n from ingestion_runs where provider = 'admitad'`,
    )
    expect(rows[0].n).toBeGreaterThan(0)
  })

  it('honours the accepted-per-run ceiling', async () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      product({ externalId: `CAP-${i}`, title: `Capped Item ${i}`, brand: 'Calder' }),
    )
    const summary = await runCatalogIngestion(context.db, new StubProvider([many]), {
      rules: { ...RULES, maxAcceptedPerRun: 3 },
    })

    expect(summary.accepted).toBe(3)
  })
})

async function countListings(context: TestDb): Promise<number> {
  const rows = await context.db.query<{ n: number }>(
    `select count(*)::int as n from merchant_products`,
  )
  return rows[0].n
}
