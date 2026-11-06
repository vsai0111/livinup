import 'server-only'
import { resolveDbDriver } from '@/config/env.server'
import { logger } from '@/lib/logging/logger'
import { createDbHandle } from './connect'
import type { DbHandle } from './types'

export type { Db, DbHandle } from './types'
export { queryOne } from './types'
export { createDbHandle } from './connect'

/**
 * Process-wide database handle.
 *
 * Held on `globalThis` so Next.js dev-server hot reloads reuse one connection
 * pool (and one PGlite instance) instead of leaking a new one per reload.
 */
declare global {
  var __livinupDb: Promise<DbHandle> | undefined
}

async function connect(): Promise<DbHandle> {
  const handle = await createDbHandle()
  if (handle.driver === 'pglite') await bootstrapEmbedded(handle)
  return handle
}

/**
 * Make the embedded database usable on first run.
 *
 * Only ever runs for PGlite — a development/test database that starts empty, so
 * that `npm run dev` works immediately after a clone with no setup step. A
 * remote Postgres is migrated explicitly via `npm run db:migrate` and is never
 * modified implicitly at request time.
 *
 * Migrations only. There is no sample data: the product is meant to be tried
 * with your own wardrobe.
 */
async function bootstrapEmbedded(db: DbHandle): Promise<void> {
  const { migrate } = await import('./migrate')
  const { applied } = await migrate(db)
  if (applied.length > 0) logger.info('embedded database migrated', { applied })
}

/** Get the shared database handle, connecting on first use. */
export function getDb(): Promise<DbHandle> {
  if (!globalThis.__livinupDb) {
    globalThis.__livinupDb = connect().catch((error: unknown) => {
      // Never cache a failed connection: the next request should retry.
      globalThis.__livinupDb = undefined
      throw error
    })
  }
  return globalThis.__livinupDb
}

/** Close and forget the shared handle. Used by tests and shutdown paths. */
export async function closeDb(): Promise<void> {
  const pending = globalThis.__livinupDb
  globalThis.__livinupDb = undefined
  if (!pending) return
  try {
    const handle = await pending
    await handle.close()
  } catch (error) {
    logger.warn('error closing database', { error })
  }
}

/** Which driver the current configuration resolves to. */
export function currentDriver(): 'postgres' | 'pglite' {
  return resolveDbDriver()
}
