import 'server-only'
import { NOTIFICATION_RETENTION_DAYS } from '@/config/community'
import type { Db } from '@/lib/db/types'
import { isoDate, str, strOrNull } from '@/lib/db/rows'
import { AUTHOR_COLUMNS, authorFromRow, type AuthorRow } from '@/lib/profiles/repository'
import type { AuthorSummary, NotificationType, NotificationView } from '@/types/community'
import { isBlockedEitherWay, notBlockedSql } from './blocks'

/**
 * In-app notifications: follows, likes, comments, and moderation outcomes.
 *
 * One row per event, grouped when read (likes on the same post become one
 * entry). Nothing is created for your own actions or between accounts that
 * have blocked each other.
 */

export async function notify(
  db: Db,
  input: {
    recipientId: string
    actorId: string
    type: NotificationType
    postId?: string | null
    commentId?: string | null
  },
): Promise<void> {
  if (input.recipientId === input.actorId) return
  const moderation = input.type === 'content_removed' || input.type === 'report_resolved'
  if (!moderation && (await isBlockedEitherWay(db, input.recipientId, input.actorId))) return

  await db.query(
    `insert into notifications (recipient_id, actor_id, type, post_id, comment_id)
     values ($1, $2, $3, $4, $5)`,
    [input.recipientId, input.actorId, input.type, input.postId ?? null, input.commentId ?? null],
  )
}

/** Remove the like notification when a like is withdrawn. */
export async function retractLikeNotification(db: Db, actorId: string, postId: string) {
  await db.query(
    `delete from notifications where actor_id = $1 and post_id = $2 and type = 'like'`,
    [actorId, postId],
  )
}

export async function unreadCount(db: Db, recipientId: string): Promise<number> {
  const rows = await db.query<{ n: number }>(
    `select count(*)::int as n from notifications n
       join profiles a on a.id = n.actor_id
      where n.recipient_id = $1 and n.read_at is null
        and (a.status = 'active' or n.type in ('content_removed', 'report_resolved'))
        and (n.type in ('content_removed', 'report_resolved') or ${notBlockedSql('$1', 'n.actor_id')})`,
    [recipientId],
  )
  return rows[0]?.n ?? 0
}

export async function markAllRead(db: Db, recipientId: string): Promise<void> {
  await db.query(
    'update notifications set read_at = now() where recipient_id = $1 and read_at is null',
    [recipientId],
  )
}

const MODERATION_ACTOR: AuthorSummary = {
  id: 'livinup',
  username: '',
  displayName: 'LivinUp',
  avatarMediaId: null,
  accountType: 'member',
  verified: false,
}

export async function listNotifications(
  db: Db,
  recipientId: string,
  limit: number,
): Promise<NotificationView[]> {
  const rows = await db.query<
    AuthorRow & {
      notification_id: unknown
      type: unknown
      post_id: unknown
      post_image_id: unknown
      comment_body: unknown
      created_at: unknown
      read_at: unknown
      actor_status: unknown
    }
  >(
    `select n.id as notification_id, n.type, n.post_id, n.created_at, n.read_at,
            p.status as actor_status, ${AUTHOR_COLUMNS},
            (select pi.media_id from post_images pi where pi.post_id = n.post_id
              order by pi.position limit 1) as post_image_id,
            (select left(c.body, 120) from comments c where c.id = n.comment_id) as comment_body
       from notifications n
       join profiles p on p.id = n.actor_id
      where n.recipient_id = $1
        and (
          n.type in ('content_removed', 'report_resolved')
          or (p.status = 'active' and ${notBlockedSql('$1', 'n.actor_id')})
        )
      order by n.created_at desc
      limit 300`,
    [recipientId],
  )

  const views: NotificationView[] = []
  const likeGroups = new Map<string, NotificationView>()

  for (const row of rows) {
    const type = str(row.type) as NotificationType
    const moderation = type === 'content_removed' || type === 'report_resolved'
    const actor = moderation ? MODERATION_ACTOR : authorFromRow(row)
    const unread = row.read_at === null || row.read_at === undefined
    const postId = strOrNull(row.post_id)

    if (type === 'like' && postId) {
      const group = likeGroups.get(postId)
      if (group) {
        if (!group.actors.some((a) => a.id === actor.id)) {
          group.actorCount += 1
          if (group.actors.length < 3) group.actors.push(actor)
        }
        group.unread = group.unread || unread
        continue
      }
    }

    const view: NotificationView = {
      id: str(row.notification_id),
      type,
      actors: [actor],
      actorCount: 1,
      postId,
      postImageId: strOrNull(row.post_image_id),
      commentSnippet: strOrNull(row.comment_body),
      createdAt: isoDate(row.created_at),
      unread,
    }
    if (type === 'like' && postId) likeGroups.set(postId, view)
    views.push(view)
    if (views.length >= limit) break
  }
  return views
}

/** Drop notifications older than the retention window. */
export async function pruneNotifications(db: Db): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `delete from notifications where created_at < now() - ($1::int * interval '1 day') returning id`,
    [NOTIFICATION_RETENTION_DAYS],
  )
  return rows.length
}
