import 'server-only'
import type { Db } from '@/lib/db/types'
import { logger } from '@/lib/logging/logger'
import { enqueueDeletions, processDeletionQueue } from '@/lib/media/repository'

/**
 * Account deletion (docs/product-spec.md 7.4, F13).
 *
 *   1. Mark the profile `deleting`: it disappears everywhere and cannot sign in.
 *   2. Queue every stored file the account owns, and try to delete them now.
 *   3. Delete the database rows in one transaction. `profiles` cascades to
 *      everything the account owns; the auth record goes last.
 *   4. Files the storage API failed to delete stay queued and are retried by
 *      the daily cleanup. The queue does not reference the profile, so it
 *      outlives it.
 *
 * Reports the account filed are kept with the reporter cleared, and the
 * moderation log keeps its entries with the admin cleared, so the audit trail
 * survives.
 */
export async function deleteAccount(db: Db, userId: string): Promise<void> {
  await db.query(`update profiles set status = 'deleting' where id = $1`, [userId])

  const files = await db.query<{ bucket: string; storage_key: string }>(
    'select bucket, storage_key from media where owner_id = $1',
    [userId],
  )
  await enqueueDeletions(db, files)
  const result = await processDeletionQueue(db, {
    keys: files.map((file) => file.storage_key),
    limit: files.length || 1,
  })
  if (result.failed > 0) {
    logger.warn('account deletion: some files will be removed by the cleanup job', {
      userId,
      failed: result.failed,
    })
  }

  await db.transaction(async (tx) => {
    await tx.query('delete from profiles where id = $1', [userId])
    await tx.query('delete from local_auth_users where id = $1', [userId])

    const auth = await tx.query<{ present: boolean }>(
      `select to_regclass('auth.users') is not null as present`,
    )
    if (auth[0]?.present) {
      await tx.query('delete from auth.users where id = $1', [userId])
    }
  })
}

/**
 * Finish deletions that stopped part-way (a crash between steps). Run by the
 * cleanup job.
 */
export async function finishStalledDeletions(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `select id::text from profiles where status = 'deleting' limit 50`,
  )
  for (const row of rows) {
    try {
      await deleteAccount(db, row.id)
    } catch (error) {
      logger.warn('stalled account deletion failed again', { userId: row.id, error })
    }
  }
  return rows.length
}
