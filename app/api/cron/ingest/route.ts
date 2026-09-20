import { after } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/config/env.server'
import { getDb } from '@/lib/db'
import { logger } from '@/lib/logging/logger'
import { runCatalogIngestion } from '@/services/ingestion/catalog-run'
import { CATALOG_PROVIDERS, getCatalogProvider } from '@/services/ingestion/registry'

/**
 * Scheduled catalogue ingestion.
 *
 *   GET /api/cron/ingest              every ready provider
 *   GET /api/cron/ingest?provider=... one provider
 *
 * Intended for Vercel Cron, which issues a plain GET with
 * `Authorization: Bearer $CRON_SECRET`. No Vercel configuration is added by
 * this change — see docs/product-data.md for the `vercel.json` entry to add
 * when you want it scheduled.
 *
 * This route never serves a user. Nothing in the product calls a provider
 * during a page render: the frontend reads the database and only the database.
 */

export const dynamic = 'force-dynamic'
// Ingestion is minutes of work, not milliseconds. Node runtime because the
// pipeline uses node:crypto and a real Postgres driver.
export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request): Promise<Response> {
  const env = serverEnv()

  // Fail closed. With no secret configured the endpoint is disabled outright
  // rather than left open — an unauthenticated ingestion trigger is a free
  // way to burn an affiliate rate limit.
  if (!env.INGESTION_CRON_SECRET) {
    return json({ error: 'ingestion is not configured' }, 503)
  }
  if (!isAuthorized(request, env.INGESTION_CRON_SECRET)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const requested = new URL(request.url).searchParams.get('provider')
  const entries = requested
    ? [getCatalogProvider(requested)].filter((entry) => entry !== null)
    : CATALOG_PROVIDERS

  if (entries.length === 0) {
    return json({ error: 'unknown provider' }, 400)
  }

  // Respond immediately and do the work after the response is sent, so a slow
  // feed cannot turn into a platform request timeout mid-write.
  after(async () => {
    const db = await getDb()
    for (const entry of entries) {
      try {
        const provider = entry.create()
        const readiness = provider.readiness()
        if (!readiness.ready) {
          logger.info('scheduled ingestion skipped provider', {
            provider: entry.id,
            reason: readiness.reason,
          })
          continue
        }
        const summary = await runCatalogIngestion(db, provider)
        logger.info('scheduled ingestion finished', {
          provider: entry.id,
          status: summary.status,
          inserted: summary.inserted,
          updated: summary.updated,
          filtered: summary.filtered,
        })
      } catch (error) {
        // One provider failing must not stop the others.
        logger.error('scheduled ingestion threw', { provider: entry.id, error })
      }
    }
  })

  return json({ accepted: entries.map((entry) => entry.id) }, 202)
}

/**
 * Constant-time bearer check.
 *
 * `===` on a secret leaks its prefix through timing. Lengths are compared first
 * because timingSafeEqual throws on a mismatch.
 */
function isAuthorized(request: Request, secret: string): boolean {
  const header = request.headers.get('authorization') ?? ''
  const prefix = 'Bearer '
  if (!header.startsWith(prefix)) return false

  const supplied = Buffer.from(header.slice(prefix.length))
  const expected = Buffer.from(secret)
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}
