import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createTestDb, createTestUser, type TestDb } from '../helpers/db'

/**
 * Database access model (docs/product-spec.md 7.2).
 *
 * The browser holds Supabase's public key, which reaches the database as
 * `anon` or `authenticated`. LivinUp never uses that path: the server connects
 * as the table owner and authorises every query itself. So the client roles
 * are granted nothing on any table, and RLS is on everywhere as a second layer.
 *
 * These tests pin that. A single stray `grant` in a future migration would let
 * anyone with the public key read wardrobes, or (as 0004 did on profiles)
 * promote themselves to admin.
 */
describe('database access model', () => {
  let context: TestDb
  let alice: string

  beforeAll(async () => {
    context = await createTestDb()
    alice = (await createTestUser(context.db, { displayName: 'Alice' })).id
  }, 120_000)

  afterAll(async () => {
    await context?.close()
  })

  async function asRole<T = Record<string, unknown>>(
    role: 'anon' | 'authenticated',
    sql: string,
    params: unknown[] = [],
    userId: string | null = null,
  ): Promise<T[]> {
    return context.db.transaction(async (tx) => {
      await tx.query('select set_config($1, $2, true)', ['app.user_id', userId ?? ''])
      await tx.exec(`set local role ${role}`)
      return tx.query<T>(sql, params)
    })
  }

  async function publicTables(): Promise<string[]> {
    const rows = await context.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and c.relname <> 'schema_migrations'
        order by 1`,
    )
    return rows.map((row) => row.relname)
  }

  it('has dropped every shopping table', async () => {
    const tables = await publicTables()
    for (const retired of [
      'products',
      'merchants',
      'merchant_products',
      'price_history',
      'saved_products',
      'affiliate_clicks',
      'ingestion_runs',
    ]) {
      expect(tables).not.toContain(retired)
    }
  })

  it('keeps the user data that predates v1', async () => {
    const tables = await publicTables()
    for (const kept of ['profiles', 'user_preferences', 'user_events', 'local_auth_users']) {
      expect(tables).toContain(kept)
    }
  })

  it('has RLS enabled on every application table', async () => {
    const rows = await context.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
          and c.relname <> 'schema_migrations' and c.relrowsecurity = false`,
    )
    expect(rows.map((row) => row.relname)).toEqual([])
  })

  it('grants no client role any privilege on any application table', async () => {
    const rows = await context.db.query<{
      table_name: string
      grantee: string
      privilege_type: string
    }>(
      `select table_name, grantee, privilege_type from information_schema.role_table_grants
        where table_schema = 'public' and grantee in ('anon', 'authenticated')
          and table_name <> 'schema_migrations'`,
    )
    expect(rows).toEqual([])
  })

  it('refuses to let a signed-in client read or edit their own profile directly', async () => {
    // The privilege escalation 0007 closes: before it, this update succeeded.
    await expect(
      asRole('authenticated', `update profiles set role = 'admin' where id = $1`, [alice], alice),
    ).rejects.toThrow(/permission denied/i)
    await expect(asRole('authenticated', 'select * from profiles', [], alice)).rejects.toThrow(
      /permission denied/i,
    )

    const rows = await context.db.query<{ role: string }>(
      'select role from profiles where id = $1',
      [alice],
    )
    expect(rows[0]?.role).toBe('member')
  })

  it('denies client roles every user-content table', async () => {
    for (const table of [
      'wardrobe_items',
      'media',
      'outfits',
      'posts',
      'comments',
      'follows',
      'blocks',
      'notifications',
      'reports',
      'local_auth_users',
      'user_preferences',
      'user_events',
    ]) {
      for (const role of ['anon', 'authenticated'] as const) {
        await expect(asRole(role, `select * from ${table}`, [], alice)).rejects.toThrow(
          /permission denied/i,
        )
      }
    }
  })
})
