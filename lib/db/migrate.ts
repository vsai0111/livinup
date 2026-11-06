import 'server-only'
import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Db } from './types'
import { logger } from '@/lib/logging/logger'

/**
 * Forward-only SQL migration runner.
 *
 * Migrations are plain `.sql` files applied in filename order and recorded in
 * `schema_migrations`. The checksum guards against a migration being edited
 * after it has been applied somewhere, which is the usual way schema drift
 * starts.
 */

export const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations')

export type Migration = { name: string; sql: string; checksum: string }

export async function loadMigrations(dir = MIGRATIONS_DIR): Promise<Migration[]> {
  const entries = await readdir(dir)
  const files = entries.filter((f) => f.endsWith('.sql')).sort()

  return Promise.all(
    files.map(async (name) => {
      const raw = await readFile(path.join(dir, name), 'utf8')
      // Normalise line endings before hashing, so a Windows checkout and a
      // Linux CI runner agree on the checksum of the same migration.
      const sql = raw.replace(/\r\n/g, '\n')
      return { name, sql, checksum: createHash('sha256').update(sql).digest('hex').slice(0, 16) }
    }),
  )
}

async function ensureMigrationsTable(db: Db): Promise<void> {
  await db.exec(`
    create table if not exists schema_migrations (
      name        text primary key,
      checksum    text not null,
      applied_at  timestamptz not null default now()
    );
  `)
}

export type MigrateResult = { applied: string[]; skipped: string[] }

export interface MigrateOptions {
  dir?: string
  /**
   * Stop after this migration (inclusive), e.g. `0007_community.sql`. Lets an
   * additive change be applied before a destructive one that must wait for a
   * deploy.
   */
  upTo?: string
}

export async function migrate(
  db: Db,
  options: MigrateOptions | string = {},
): Promise<MigrateResult> {
  const { dir = MIGRATIONS_DIR, upTo } = typeof options === 'string' ? { dir: options } : options
  await ensureMigrationsTable(db)

  const all = await loadMigrations(dir)
  if (upTo && !all.some((m) => m.name === upTo)) {
    throw new Error(`No migration named "${upTo}".`)
  }
  const migrations = upTo ? all.filter((m) => m.name <= upTo) : all

  const existing = await db.query<{ name: string; checksum: string }>(
    'select name, checksum from schema_migrations',
  )
  const applied = new Map(existing.map((r) => [r.name, r.checksum]))

  const result: MigrateResult = { applied: [], skipped: [] }

  for (const migration of migrations) {
    const previous = applied.get(migration.name)

    if (previous) {
      if (previous !== migration.checksum && previous !== legacyChecksum(migration)) {
        throw new Error(
          `Migration "${migration.name}" changed after it was applied ` +
            `(recorded ${previous}, found ${migration.checksum}). ` +
            'Migrations are immutable — add a new migration instead.',
        )
      }
      result.skipped.push(migration.name)
      continue
    }

    await db.transaction(async (tx) => {
      await tx.exec(migration.sql)
      await tx.query('insert into schema_migrations (name, checksum) values ($1, $2)', [
        migration.name,
        migration.checksum,
      ])
    })

    logger.info('migration applied', { migration: migration.name })
    result.applied.push(migration.name)
  }

  return result
}

/**
 * Checksum as recorded by the runner before line endings were normalised.
 *
 * Migrations applied from an LF checkout recorded the LF hash, which is what
 * `checksum` is now. Ones applied from a CRLF checkout recorded the CRLF hash;
 * accept that too, so normalising does not make history look edited.
 */
function legacyChecksum(migration: Migration): string {
  return createHash('sha256')
    .update(migration.sql.replace(/\n/g, '\r\n'))
    .digest('hex')
    .slice(0, 16)
}

/** True when the core schema is present. */
export async function isMigrated(db: Db): Promise<boolean> {
  const rows = await db.query<{ present: boolean }>(
    `select to_regclass('public.profiles') is not null as present`,
  )
  return Boolean(rows[0]?.present)
}
