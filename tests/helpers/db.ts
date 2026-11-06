import { randomBytes } from 'node:crypto'
import { rm } from 'node:fs/promises'
import path from 'node:path'
import { createPgliteHandle } from '@/lib/db/driver-pglite'
import { migrate } from '@/lib/db/migrate'
import type { DbHandle } from '@/lib/db/types'

/**
 * Integration-test database.
 *
 * Each call builds a fresh PostgreSQL (PGlite) and applies the real
 * migrations, so tests exercise actual SQL (constraints, triggers, RLS) rather
 * than a mock that would happily agree with a broken query.
 */
export interface TestDb {
  db: DbHandle
  close: () => Promise<void>
}

export async function createTestDb(): Promise<TestDb> {
  // File-backed and unique per call, removed on close, so tests stay isolated.
  const dataDir = path.join('.livinup', `test-${randomBytes(6).toString('hex')}`)
  const db = await createPgliteHandle(dataDir)
  await migrate(db)
  return {
    db,
    close: async () => {
      await db.close()
      await rm(dataDir, { recursive: true, force: true }).catch(() => {})
    },
  }
}

let counter = 0

/**
 * Insert a fully onboarded profile directly, bypassing auth, for tests that
 * need a user.
 */
export async function createTestUser(
  db: DbHandle,
  options: { displayName?: string; username?: string; accountType?: 'member' | 'brand' } = {},
): Promise<{ id: string; username: string }> {
  counter += 1
  const username = options.username ?? `user${counter}${randomBytes(2).toString('hex')}`
  const rows = await db.query<{ id: string }>(
    `insert into profiles (id, display_name, username, account_type, onboarding_completed)
     values (gen_random_uuid(), $1, $2, $3, true) returning id::text`,
    [options.displayName ?? 'Test User', username, options.accountType ?? 'member'],
  )
  return { id: rows[0]!.id, username }
}
