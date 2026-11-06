import { timingSafeEqual } from 'node:crypto'
import { serverEnv } from '@/config/env.server'
import { finishStalledDeletions } from '@/lib/account/delete'
import { pruneNotifications } from '@/lib/community/notifications'
import { getDb } from '@/lib/db'
import { logger, reportError } from '@/lib/logging/logger'
import { deleteOrphanedMedia, processDeletionQueue } from '@/lib/media/repository'

/**
 * Scheduled housekeeping (Vercel Cron, daily). Authenticated with
 * `Authorization: Bearer $CRON_SECRET`; without a configured secret the
 * endpoint refuses every call rather than running unauthenticated.
 *
 * Each step is independent, so one failing does not stop the others.
 */
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function authorised(request: Request): boolean {
  const secret = serverEnv().CRON_SECRET
  if (!secret) return false
  const header = request.headers.get('authorization') ?? ''
  const expected = Buffer.from(`Bearer ${secret}`)
  const provided = Buffer.from(header)
  return expected.length === provided.length && timingSafeEqual(expected, provided)
}

export async function GET(request: Request) {
  if (!authorised(request)) {
    return Response.json({ error: 'unauthorised' }, { status: 401 })
  }

  const db = await getDb()
  const summary: Record<string, unknown> = {}
  const steps: [string, () => Promise<unknown>][] = [
    ['stalledDeletions', () => finishStalledDeletions(db)],
    ['orphanedMedia', () => deleteOrphanedMedia(db)],
    ['deletionQueue', () => processDeletionQueue(db)],
    ['prunedNotifications', () => pruneNotifications(db)],
  ]

  for (const [name, run] of steps) {
    try {
      summary[name] = await run()
    } catch (error) {
      summary[name] = { error: reportError(error, { operation: `cron.cleanup.${name}` }) }
    }
  }

  logger.info('cleanup finished', summary)
  return Response.json({ ok: true, ...summary })
}
