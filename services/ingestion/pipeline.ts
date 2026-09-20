import type { Db } from '@/lib/db/types'
import type { MerchantProvider } from '@/lib/merchants/provider'
import { logger } from '@/lib/logging/logger'
import { normalizeProduct } from '@/services/normalization/normalize'
import { persistProduct, upsertMerchant } from './persist'

/**
 * The ingestion pipeline.
 *
 *   provider -> validation -> normalization -> canonical product
 *            -> variants -> merchant listing -> price observation
 *
 * Provider-agnostic by construction: it accepts any `MerchantProvider`, so
 * adding a real merchant feed means writing a provider, not touching this file.
 *
 * This is the SINGLE-MERCHANT path, and the seed catalogue is its only caller.
 * Affiliate networks front many merchants behind one credential and so run
 * through `runCatalogIngestion` (./catalog-run.ts) instead; both share the
 * normalizer, the matcher and the persistence layer in ./persist.ts.
 *
 * Failures are per-product, not per-batch. One malformed listing in a feed of
 * ten thousand must not abort the run, but it must also never be silently
 * dropped — every rejection is counted and returned.
 */

export interface IngestionSummary {
  merchantSlug: string
  merchantId: string
  fetched: number
  ingested: number
  rejected: number
  warnings: number
  /** Capped sample of rejections, for logging and the ingestion report. */
  rejectionSamples: Array<{ externalId: string; errors: string[] }>
}

export interface IngestOptions {
  /** Stop after this many products. Useful for smoke tests. */
  limit?: number
  /** Backfill historical prices for each listing. Seed provider only. */
  backfillHistory?: (externalId: string) => Array<{ price: number; recordedAt: Date }>
  /** Timestamp recorded for the current price observation. */
  now?: Date
}

const MAX_REJECTION_SAMPLES = 20

export async function ingestFromProvider(
  db: Db,
  provider: MerchantProvider,
  options: IngestOptions = {},
): Promise<IngestionSummary> {
  const descriptor = provider.descriptor()
  const log = logger.child({ provider: provider.id, merchant: descriptor.slug })

  const merchantId = await upsertMerchant(db, descriptor)

  const summary: IngestionSummary = {
    merchantSlug: descriptor.slug,
    merchantId,
    fetched: 0,
    ingested: 0,
    rejected: 0,
    warnings: 0,
    rejectionSamples: [],
  }

  let cursor: string | null = null

  do {
    const page = await provider.getProducts({ cursor, limit: 50 })
    cursor = page.cursor

    for (const raw of page.products) {
      if (options.limit !== undefined && summary.fetched >= options.limit) {
        cursor = null
        break
      }
      summary.fetched += 1

      const outcome = normalizeProduct(raw)

      if (!outcome.ok) {
        summary.rejected += 1
        if (summary.rejectionSamples.length < MAX_REJECTION_SAMPLES) {
          summary.rejectionSamples.push({ externalId: raw.externalId, errors: outcome.errors })
        }
        log.warn('product rejected during normalization', {
          externalId: raw.externalId,
          errors: outcome.errors,
        })
        continue
      }

      summary.warnings += outcome.warnings.length

      try {
        await persistProduct(db, merchantId, outcome.value, options)
        summary.ingested += 1
      } catch (error) {
        summary.rejected += 1
        if (summary.rejectionSamples.length < MAX_REJECTION_SAMPLES) {
          summary.rejectionSamples.push({
            externalId: raw.externalId,
            errors: [error instanceof Error ? error.message : 'unknown persistence error'],
          })
        }
        log.error('failed to persist product', { externalId: raw.externalId, error })
      }
    }
  } while (cursor)

  log.info('ingestion complete', { ...summary, rejectionSamples: summary.rejectionSamples.length })
  return summary
}
