import 'server-only'
import type { Db } from '@/lib/db/types'
import { isoDate, str, strOrNull } from '@/lib/db/rows'

/**
 * Blocking.
 *
 * A block hides each account's profile, posts and comments from the other,
 * stops follows, likes and comments in both directions, and removes existing
 * follows both ways (docs/product-spec.md 3.3). The blocked person is not told.
 */

/**
 * SQL that is true when `viewer` and `other` have NOT blocked each other.
 * `viewer` is a bound parameter reference such as `$1`; `other` a column.
 * A null viewer (signed out) never matches a block.
 */
export function notBlockedSql(viewer: string, other: string): string {
  return `not exists (
    select 1 from blocks bl
     where (bl.blocker_id = ${viewer}::uuid and bl.blocked_id = ${other})
        or (bl.blocker_id = ${other} and bl.blocked_id = ${viewer}::uuid)
  )`
}

export async function isBlockedEitherWay(db: Db, a: string, b: string): Promise<boolean> {
  if (a === b) return false
  const rows = await db.query<{ blocked: boolean }>(
    `select exists (
       select 1 from blocks
        where (blocker_id = $1 and blocked_id = $2) or (blocker_id = $2 and blocked_id = $1)
     ) as blocked`,
    [a, b],
  )
  return Boolean(rows[0]?.blocked)
}

export async function hasBlocked(db: Db, blocker: string, blocked: string): Promise<boolean> {
  const rows = await db.query<{ n: number }>(
    'select count(*)::int as n from blocks where blocker_id = $1 and blocked_id = $2',
    [blocker, blocked],
  )
  return (rows[0]?.n ?? 0) > 0
}

export async function blockUser(db: Db, blocker: string, blocked: string): Promise<void> {
  if (blocker === blocked) return
  await db.transaction(async (tx) => {
    await tx.query(
      `insert into blocks (blocker_id, blocked_id) values ($1, $2)
       on conflict do nothing`,
      [blocker, blocked],
    )
    await tx.query(
      `delete from follows
        where (follower_id = $1 and followee_id = $2) or (follower_id = $2 and followee_id = $1)`,
      [blocker, blocked],
    )
    // Notifications between the two disappear from both inboxes.
    await tx.query(
      `delete from notifications
        where (recipient_id = $1 and actor_id = $2) or (recipient_id = $2 and actor_id = $1)`,
      [blocker, blocked],
    )
  })
}

export async function unblockUser(db: Db, blocker: string, blocked: string): Promise<void> {
  await db.query('delete from blocks where blocker_id = $1 and blocked_id = $2', [blocker, blocked])
}

export interface BlockedAccount {
  id: string
  username: string | null
  displayName: string
  blockedAt: string
}

export async function listBlocked(db: Db, blocker: string): Promise<BlockedAccount[]> {
  const rows = await db.query<{
    id: unknown
    username: unknown
    display_name: unknown
    created_at: unknown
  }>(
    `select p.id, p.username, p.display_name, b.created_at
       from blocks b join profiles p on p.id = b.blocked_id
      where b.blocker_id = $1
      order by b.created_at desc`,
    [blocker],
  )
  return rows.map((row) => ({
    id: str(row.id),
    username: strOrNull(row.username),
    displayName: str(row.display_name),
    blockedAt: isoDate(row.created_at),
  }))
}
