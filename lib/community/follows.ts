import 'server-only'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { assertWithinLimit } from '@/lib/moderation/rate-limit'
import { AUTHOR_COLUMNS, authorFromRow, type AuthorRow } from '@/lib/profiles/repository'
import type { AuthorSummary } from '@/types/community'
import { isBlockedEitherWay, notBlockedSql } from './blocks'
import { notify } from './notifications'

/** One-way following. */

export async function follow(db: Db, followerId: string, followeeId: string): Promise<boolean> {
  if (followerId === followeeId) throw new UserFacingError('You cannot follow yourself.')

  const target = await db.query<{ ok: boolean }>(
    `select exists (select 1 from profiles where id = $1 and status = 'active' and username is not null) as ok`,
    [followeeId],
  )
  if (!target[0]?.ok) throw new UserFacingError('That account is not available.')
  if (await isBlockedEitherWay(db, followerId, followeeId)) {
    throw new UserFacingError('That account is not available.')
  }

  await assertWithinLimit(db, followerId, 'follow')

  const inserted = await db.query<{ follower_id: string }>(
    `insert into follows (follower_id, followee_id) values ($1, $2)
     on conflict do nothing returning follower_id`,
    [followerId, followeeId],
  )
  if (inserted.length > 0) {
    await notify(db, { recipientId: followeeId, actorId: followerId, type: 'follow' })
    return true
  }
  return false
}

export async function unfollow(db: Db, followerId: string, followeeId: string): Promise<void> {
  await db.query('delete from follows where follower_id = $1 and followee_id = $2', [
    followerId,
    followeeId,
  ])
  await db.query(
    `delete from notifications where actor_id = $1 and recipient_id = $2 and type = 'follow'`,
    [followerId, followeeId],
  )
}

/** Followers or following of a profile, as visible to `viewerId`. */
export async function listConnections(
  db: Db,
  profileId: string,
  direction: 'followers' | 'following',
  viewerId: string | null,
  limit = 200,
): Promise<AuthorSummary[]> {
  const [mine, theirs] =
    direction === 'followers' ? ['followee_id', 'follower_id'] : ['follower_id', 'followee_id']
  const rows = await db.query<AuthorRow>(
    `select ${AUTHOR_COLUMNS}
       from follows f join profiles p on p.id = f.${theirs}
      where f.${mine} = $1 and p.status = 'active' and p.username is not null
        and ($2::uuid is null or ${notBlockedSql('$2', 'p.id')})
      order by f.created_at desc
      limit $3`,
    [profileId, viewerId, limit],
  )
  return rows.map(authorFromRow)
}
