import 'server-only'
import { RATE_LIMITS, type RateLimitedAction } from '@/config/community'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'

/**
 * Per-account rate limits, counted from the rows the action itself creates.
 * No extra service or table: the posts table already knows how many posts a
 * person published today.
 */

const COUNT_SQL: Record<RateLimitedAction, string> = {
  post: "select count(*)::int as n from posts where author_id = $1 and created_at > now() - $2 * interval '1 second'",
  comment:
    "select count(*)::int as n from comments where author_id = $1 and created_at > now() - $2 * interval '1 second'",
  follow:
    "select count(*)::int as n from follows where follower_id = $1 and created_at > now() - $2 * interval '1 second'",
  upload:
    "select count(*)::int as n from media where owner_id = $1 and created_at > now() - $2 * interval '1 second'",
  report:
    "select count(*)::int as n from reports where reporter_id = $1 and created_at > now() - $2 * interval '1 second'",
}

const MESSAGES: Record<RateLimitedAction, string> = {
  post: 'You have published a lot today. Try again tomorrow.',
  comment: 'You are commenting very quickly. Take a short break and try again.',
  follow: 'You have followed a lot of accounts today. Try again tomorrow.',
  upload: 'You have uploaded a lot of photos today. Try again tomorrow.',
  report: 'You have sent a lot of reports today. Our team is reviewing them.',
}

export async function countRecent(
  db: Db,
  userId: string,
  action: RateLimitedAction,
): Promise<number> {
  const rows = await db.query<{ n: number }>(COUNT_SQL[action], [
    userId,
    RATE_LIMITS[action].windowSeconds,
  ])
  return rows[0]?.n ?? 0
}

/** Throws a user-facing refusal when one more `action` would exceed the limit. */
export async function assertWithinLimit(
  db: Db,
  userId: string,
  action: RateLimitedAction,
  adding = 1,
): Promise<void> {
  const used = await countRecent(db, userId, action)
  if (used + adding > RATE_LIMITS[action].max) throw new UserFacingError(MESSAGES[action])
}
