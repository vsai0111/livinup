import { filterRulesFor, type CatalogFilterRules } from '@/config/catalog-filters'
import type { Db } from '@/lib/db/types'
import { logger } from '@/lib/logging/logger'
import {
  ProviderAuthError,
  ProviderError,
  ProviderRateLimitError,
  ProviderUnavailableError,
  type CatalogProvider,
  type ProviderId,
  type RawCatalogProduct,
} from '@/lib/providers/types'
import { normalizeProduct } from '@/services/normalization/normalize'
import { evaluateFilters, type FilterReason } from './filter'
import { persistProduct, upsertMerchant } from './persist'

/**
 * The real-provider ingestion run.
 *
 *   fetch → normalize → filter → canonicalize → upsert → price observation → log
 *
 * Where the seed pipeline handles one merchant per provider, this handles many:
 * an affiliate network fronts hundreds of advertisers behind one credential, so
 * the merchant is resolved per product and cached for the run.
 *
 * Failure policy, which is the substance of this file:
 *
 *   per product   a malformed listing is counted and skipped. One bad row in a
 *                 feed of ten thousand must never abort the run.
 *   per run       auth failure, rate limit or provider outage ends the run
 *                 cleanly. The existing catalogue is left exactly as it was —
 *                 nothing is deleted, deactivated, or marked stale, because a
 *                 provider having a bad morning is not evidence about our data.
 *
 * Every run writes a row to `ingestion_runs` whether it succeeds or not.
 */

export interface CatalogRunSummary {
  runId: string | null
  provider: ProviderId
  status: 'completed' | 'failed'
  fetched: number
  accepted: number
  filtered: number
  rejected: number
  inserted: number
  updated: number
  unchanged: number
  duplicates: number
  priceObservations: number
  warnings: number
  /** Why the run stopped early, if it did. Never contains credentials. */
  error?: string
  filterBreakdown: Partial<Record<FilterReason, number>>
  rejectionSamples: Array<{ externalId: string; errors: string[] }>
}

export interface CatalogRunOptions {
  /** Hard cap on accepted products, over and above the configured rule. */
  limit?: number
  /** Parse and filter, but write nothing. */
  dryRun?: boolean
  /** Override the configured filter rules. Tests and one-off backfills. */
  rules?: CatalogFilterRules
  /** Timestamp recorded for price observations. */
  now?: Date
  /** Ends the run early — a scheduled invocation enforcing its own budget. */
  signal?: AbortSignal
}

const MAX_REJECTION_SAMPLES = 20
const MAX_PAGES = 500

export async function runCatalogIngestion(
  db: Db,
  provider: CatalogProvider,
  options: CatalogRunOptions = {},
): Promise<CatalogRunSummary> {
  const log = logger.child({ provider: provider.id })
  const rules = options.rules ?? filterRulesFor(provider.id)
  const acceptCap = Math.min(options.limit ?? Number.POSITIVE_INFINITY, rules.maxAcceptedPerRun)

  const summary: CatalogRunSummary = {
    runId: null,
    provider: provider.id,
    status: 'completed',
    fetched: 0,
    accepted: 0,
    filtered: 0,
    rejected: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    duplicates: 0,
    priceObservations: 0,
    warnings: 0,
    filterBreakdown: {},
    rejectionSamples: [],
  }

  const readiness = provider.readiness()
  if (!readiness.ready) {
    summary.status = 'failed'
    summary.error = readiness.reason
    log.warn('provider not ready, skipping run', {
      reason: readiness.reason,
      missing: readiness.missing,
    })
    summary.runId = await recordRun(db, summary, options.dryRun)
    return summary
  }

  summary.runId = options.dryRun ? null : await openRun(db, provider.id)

  // Merchant rows are resolved once per slug per run, not once per product.
  const merchantIds = new Map<string, string>()
  // Guards against a feed listing the same offer twice in one run, which would
  // otherwise read as an insert followed immediately by a no-op update.
  const seen = new Set<string>()

  try {
    let cursor: string | null = null
    let pages = 0

    do {
      if (options.signal?.aborted) {
        summary.error = 'run aborted before completion'
        break
      }
      if (summary.accepted >= acceptCap) break
      if (++pages > MAX_PAGES) {
        summary.error = `stopped after ${MAX_PAGES} pages`
        log.warn('page limit reached', { pages })
        break
      }

      const page = await provider.getProducts({ cursor, limit: 200, signal: options.signal })
      cursor = page.cursor

      for (const raw of page.products) {
        if (summary.accepted >= acceptCap) {
          cursor = null
          break
        }
        summary.fetched += 1

        await ingestOne(db, provider.id, raw, rules, options, summary, merchantIds, seen, log)
      }
    } while (cursor)
  } catch (error) {
    // A provider-level failure ends the run and leaves the catalogue untouched.
    summary.status = 'failed'
    summary.error = describeProviderError(error)
    log.error('ingestion run failed', { error: summary.error })
  }

  await closeRun(db, summary, options.dryRun)

  log.info('ingestion run finished', {
    ...summary,
    rejectionSamples: summary.rejectionSamples.length,
  })
  return summary
}

/** One product, all the way through. Never throws. */
async function ingestOne(
  db: Db,
  providerId: ProviderId,
  raw: RawCatalogProduct,
  rules: CatalogFilterRules,
  options: CatalogRunOptions,
  summary: CatalogRunSummary,
  merchantIds: Map<string, string>,
  seen: Set<string>,
  log: ReturnType<typeof logger.child>,
): Promise<void> {
  const dedupeKey = `${raw.merchant.slug}:${raw.externalId}`
  if (seen.has(dedupeKey)) {
    summary.duplicates += 1
    return
  }
  seen.add(dedupeKey)

  const outcome = normalizeProduct(raw)

  if (!outcome.ok) {
    summary.rejected += 1
    if (summary.rejectionSamples.length < MAX_REJECTION_SAMPLES) {
      summary.rejectionSamples.push({ externalId: raw.externalId, errors: outcome.errors })
    }
    return
  }

  summary.warnings += outcome.warnings.length

  const decision = evaluateFilters(outcome.value, rules)
  if (!decision.accepted) {
    summary.filtered += 1
    summary.filterBreakdown[decision.reason] = (summary.filterBreakdown[decision.reason] ?? 0) + 1
    return
  }

  summary.accepted += 1
  if (options.dryRun) return

  try {
    let merchantId = merchantIds.get(raw.merchant.slug)
    if (!merchantId) {
      merchantId = await upsertMerchant(db, raw.merchant)
      merchantIds.set(raw.merchant.slug, merchantId)
    }

    const result = await persistProduct(db, merchantId, outcome.value, {
      provider: providerId,
      externalListingId: raw.externalListingId ?? null,
      now: options.now,
    })

    if (result.outcome === 'inserted') summary.inserted += 1
    else if (result.outcome === 'updated') summary.updated += 1
    else summary.unchanged += 1

    summary.priceObservations += result.priceObservations
  } catch (error) {
    // A persistence failure is this product's problem, not the run's.
    summary.accepted -= 1
    summary.rejected += 1
    if (summary.rejectionSamples.length < MAX_REJECTION_SAMPLES) {
      summary.rejectionSamples.push({
        externalId: raw.externalId,
        errors: [error instanceof Error ? error.message : 'unknown persistence error'],
      })
    }
    log.error('failed to persist product', { externalId: raw.externalId })
  }
}

/**
 * A safe, human-readable description of a failure.
 *
 * Provider errors are summarised by class. An unknown error's message is NOT
 * included: it could have come from an HTTP client that helpfully embedded the
 * request URL, and a feed URL can carry a token in its query string.
 */
function describeProviderError(error: unknown): string {
  if (error instanceof ProviderAuthError) return 'provider authentication failed'
  if (error instanceof ProviderRateLimitError) {
    return error.retryAfterSeconds
      ? `provider rate limit reached (retry after ${error.retryAfterSeconds}s)`
      : 'provider rate limit reached'
  }
  if (error instanceof ProviderUnavailableError) return 'provider unavailable'
  if (error instanceof ProviderError) return `provider error: ${error.name}`
  if (error instanceof Error && error.name === 'TimeoutError') return 'provider request timed out'
  return 'unexpected ingestion failure'
}

/* -------------------------------------------------------------------------- */
/* Run log                                                                     */
/* -------------------------------------------------------------------------- */

async function openRun(db: Db, provider: ProviderId): Promise<string | null> {
  try {
    const rows = await db.query<{ id: string }>(
      `insert into ingestion_runs (provider, status) values ($1, 'running') returning id`,
      [provider],
    )
    return rows[0]?.id ?? null
  } catch (error) {
    // The run log is observability, not the job. Losing it must not stop work.
    logger.warn('could not open ingestion run row', { provider, error })
    return null
  }
}

async function closeRun(
  db: Db,
  summary: CatalogRunSummary,
  dryRun: boolean | undefined,
): Promise<void> {
  if (dryRun || !summary.runId) return

  try {
    await db.query(
      `update ingestion_runs
          set status = $2, finished_at = now(),
              fetched = $3, filtered = $4, rejected = $5,
              inserted = $6, updated = $7, unchanged = $8,
              duplicates = $9, price_observations = $10,
              error = $11, details = $12::jsonb
        where id = $1`,
      [
        summary.runId,
        summary.status,
        summary.fetched,
        summary.filtered,
        summary.rejected,
        summary.inserted,
        summary.updated,
        summary.unchanged,
        summary.duplicates,
        summary.priceObservations,
        summary.error ?? null,
        JSON.stringify({
          warnings: summary.warnings,
          filterBreakdown: summary.filterBreakdown,
          rejectionSamples: summary.rejectionSamples,
        }),
      ],
    )
  } catch (error) {
    logger.warn('could not close ingestion run row', { runId: summary.runId, error })
  }
}

/** Record a run that never started, so a skipped provider is still visible. */
async function recordRun(
  db: Db,
  summary: CatalogRunSummary,
  dryRun: boolean | undefined,
): Promise<string | null> {
  if (dryRun) return null
  try {
    const rows = await db.query<{ id: string }>(
      `insert into ingestion_runs (provider, status, finished_at, error)
       values ($1, 'failed', now(), $2) returning id`,
      [summary.provider, summary.error ?? null],
    )
    return rows[0]?.id ?? null
  } catch {
    return null
  }
}
