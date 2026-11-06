import 'server-only'
import { URGENT_REASONS, type ReportReason } from '@/config/community'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { isoDate, str, strOrNull } from '@/lib/db/rows'
import { logger } from '@/lib/logging/logger'
import { notify } from '@/lib/community/notifications'
import { assertWithinLimit } from './rate-limit'

/**
 * Reports, the admin queue and moderation actions.
 *
 * Every admin action is written to `moderation_actions` with who, when and
 * why. Removing a post stops /media serving its images immediately (see
 * lib/media/access.ts); cached copies expire within an hour.
 *
 * Urgent reports (intimate images, child safety) are flagged and logged at
 * error level straight away, so the log drain / error tracker alerts whoever
 * is on the moderation rota. Email alerts need a mail provider, which v1 does
 * not have; see docs/product-spec.md 9.
 */

export type ReportTarget = 'post' | 'comment' | 'profile'

async function targetExists(db: Db, type: ReportTarget, id: string): Promise<boolean> {
  const table = type === 'post' ? 'posts' : type === 'comment' ? 'comments' : 'profiles'
  const rows = await db.query<{ ok: boolean }>(
    `select exists (select 1 from ${table} where id = $1) as ok`,
    [id],
  )
  return Boolean(rows[0]?.ok)
}

export async function createReport(
  db: Db,
  reporterId: string,
  input: {
    targetType: ReportTarget
    targetId: string
    reason: ReportReason
    details: string | null
  },
): Promise<void> {
  if (!(await targetExists(db, input.targetType, input.targetId))) {
    throw new UserFacingError('That content is no longer available.')
  }
  if (input.targetType === 'profile' && input.targetId === reporterId) {
    throw new UserFacingError('You cannot report your own account.')
  }
  await assertWithinLimit(db, reporterId, 'report')

  const priority = URGENT_REASONS.has(input.reason) ? 'urgent' : 'normal'
  const rows = await db.query<{ id: string }>(
    `insert into reports (reporter_id, target_type, target_id, reason, details, priority)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [reporterId, input.targetType, input.targetId, input.reason, input.details, priority],
  )

  if (priority === 'urgent') {
    logger.error('URGENT report received: review within the takedown window', {
      alert: 'moderation_urgent',
      reportId: rows[0].id,
      reason: input.reason,
      targetType: input.targetType,
    })
  }
}

export interface QueueEntry {
  id: string
  targetType: ReportTarget
  targetId: string
  reason: ReportReason
  details: string | null
  priority: 'urgent' | 'normal'
  status: 'open' | 'actioned' | 'dismissed'
  createdAt: string
  reporterUsername: string | null
  /** What is being reported, for review without leaving the queue. */
  preview: {
    authorId: string | null
    authorUsername: string | null
    text: string | null
    imageId: string | null
    contentStatus: string | null
  }
  /** Other open reports about the same thing. */
  duplicateCount: number
}

export async function listQueue(
  db: Db,
  options: { status: 'open' | 'closed'; limit: number },
): Promise<QueueEntry[]> {
  const rows = await db.query<Record<string, unknown>>(
    `select r.id, r.target_type, r.target_id, r.reason, r.details, r.priority, r.status, r.created_at,
            rp.username as reporter_username,
            coalesce(po.author_id, c.author_id, pr.id) as author_id,
            coalesce(pa.username, ca.username, pr.username) as author_username,
            coalesce(po.caption, c.body, pr.bio, pr.display_name) as preview_text,
            (select pi.media_id from post_images pi where pi.post_id = po.id order by pi.position limit 1) as image_id,
            coalesce(po.status, c.status, pr.status) as content_status,
            (select count(*) from reports r2
              where r2.target_type = r.target_type and r2.target_id = r.target_id
                and r2.status = 'open' and r2.id <> r.id)::int as duplicate_count
       from reports r
       left join profiles rp on rp.id = r.reporter_id
       left join posts po on r.target_type = 'post' and po.id = r.target_id
       left join profiles pa on pa.id = po.author_id
       left join comments c on r.target_type = 'comment' and c.id = r.target_id
       left join profiles ca on ca.id = c.author_id
       left join profiles pr on r.target_type = 'profile' and pr.id = r.target_id
      where ($1 = 'open' and r.status = 'open') or ($1 = 'closed' and r.status <> 'open')
      order by (r.priority = 'urgent') desc, r.created_at ${options.status === 'open' ? 'asc' : 'desc'}
      limit $2`,
    [options.status, options.limit],
  )
  return rows.map((row) => ({
    id: str(row.id),
    targetType: str(row.target_type) as ReportTarget,
    targetId: str(row.target_id),
    reason: str(row.reason) as ReportReason,
    details: strOrNull(row.details),
    priority: str(row.priority) as QueueEntry['priority'],
    status: str(row.status) as QueueEntry['status'],
    createdAt: isoDate(row.created_at),
    reporterUsername: strOrNull(row.reporter_username),
    preview: {
      authorId: strOrNull(row.author_id),
      authorUsername: strOrNull(row.author_username),
      text: strOrNull(row.preview_text),
      imageId: strOrNull(row.image_id),
      contentStatus: strOrNull(row.content_status),
    },
    duplicateCount: Number(row.duplicate_count ?? 0),
  }))
}

type Action = 'remove_content' | 'suspend' | 'dismiss'

/**
 * Resolve a report. Closes every open report about the same target, records
 * the action, and tells the author (on removal) and the reporters.
 */
export async function resolveReport(
  db: Db,
  adminId: string,
  reportId: string,
  action: Action,
  reason: string,
): Promise<void> {
  const note = reason.trim()
  if (note.length === 0) throw new UserFacingError('Give a reason. It goes in the audit log.')

  const reports = await db.query<{ target_type: ReportTarget; target_id: string }>(
    `select target_type, target_id::text as target_id from reports where id = $1`,
    [reportId],
  )
  const report = reports[0]
  if (!report) throw new UserFacingError('That report could not be found.')

  let authorId: string | null = null

  await db.transaction(async (tx) => {
    if (action === 'remove_content') {
      if (report.target_type === 'post') {
        const rows = await tx.query<{ author_id: string }>(
          `update posts set status = 'removed', removed_reason = $2 where id = $1 returning author_id::text`,
          [report.target_id, note],
        )
        authorId = rows[0]?.author_id ?? null
        await logAction(tx, adminId, 'remove_post', 'post', report.target_id, reportId, note)
      } else if (report.target_type === 'comment') {
        const rows = await tx.query<{ author_id: string }>(
          `update comments set status = 'removed' where id = $1 returning author_id::text`,
          [report.target_id],
        )
        authorId = rows[0]?.author_id ?? null
        await logAction(tx, adminId, 'remove_comment', 'comment', report.target_id, reportId, note)
      } else {
        throw new UserFacingError('A profile cannot be removed. Suspend the account instead.')
      }
    } else if (action === 'suspend') {
      const target =
        report.target_type === 'profile'
          ? report.target_id
          : (
              await tx.query<{ author_id: string }>(
                report.target_type === 'post'
                  ? 'select author_id::text from posts where id = $1'
                  : 'select author_id::text from comments where id = $1',
                [report.target_id],
              )
            )[0]?.author_id
      if (!target) throw new UserFacingError('The account behind that content could not be found.')
      if (target === adminId) throw new UserFacingError('You cannot suspend your own account.')
      await tx.query(
        `update profiles set status = 'suspended' where id = $1 and status = 'active'`,
        [target],
      )
      await logAction(tx, adminId, 'suspend', 'profile', target, reportId, note)
    } else {
      await logAction(
        tx,
        adminId,
        'dismiss_report',
        report.target_type,
        report.target_id,
        reportId,
        note,
      )
    }

    await tx.query(
      `update reports set status = $3, resolved_by = $1, resolved_at = now(), resolution_note = $2
        where status = 'open' and target_type = $4 and target_id = $5`,
      [
        adminId,
        note,
        action === 'dismiss' ? 'dismissed' : 'actioned',
        report.target_type,
        report.target_id,
      ],
    )
  })

  if (action === 'remove_content' && authorId) {
    await notify(db, {
      recipientId: authorId,
      actorId: adminId,
      type: 'content_removed',
      postId: report.target_type === 'post' ? report.target_id : null,
    })
  }
  const reporters = await db.query<{ reporter_id: string }>(
    `select distinct reporter_id::text from reports
      where target_type = $1 and target_id = $2 and reporter_id is not null and resolved_by = $3`,
    [report.target_type, report.target_id, adminId],
  )
  for (const row of reporters) {
    await notify(db, { recipientId: row.reporter_id, actorId: adminId, type: 'report_resolved' })
  }
}

export async function unsuspend(db: Db, adminId: string, profileId: string, reason: string) {
  const note = reason.trim()
  if (!note) throw new UserFacingError('Give a reason. It goes in the audit log.')
  await db.transaction(async (tx) => {
    await tx.query(`update profiles set status = 'active' where id = $1 and status = 'suspended'`, [
      profileId,
    ])
    await logAction(tx, adminId, 'unsuspend', 'profile', profileId, null, note)
  })
}

export async function logAction(
  db: Db,
  adminId: string,
  action: string,
  targetType: string,
  targetId: string,
  reportId: string | null,
  reason: string,
): Promise<void> {
  await db.query(
    `insert into moderation_actions (admin_id, action, target_type, target_id, report_id, reason)
     values ($1, $2, $3, $4, $5, $6)`,
    [adminId, action, targetType, targetId, reportId, reason],
  )
}

export async function recentActions(db: Db, limit = 50) {
  const rows = await db.query<Record<string, unknown>>(
    `select m.action, m.target_type, m.target_id, m.reason, m.created_at, p.username as admin_username
       from moderation_actions m left join profiles p on p.id = m.admin_id
      order by m.created_at desc limit $1`,
    [limit],
  )
  return rows.map((row) => ({
    action: str(row.action),
    targetType: str(row.target_type),
    targetId: str(row.target_id),
    reason: str(row.reason),
    createdAt: isoDate(row.created_at),
    adminUsername: strOrNull(row.admin_username),
  }))
}

export async function suspendedAccounts(db: Db) {
  const rows = await db.query<{ id: string; username: string | null; display_name: string }>(
    `select id::text, username, display_name from profiles where status = 'suspended' order by display_name`,
  )
  return rows.map((row) => ({ id: row.id, username: row.username, displayName: row.display_name }))
}
