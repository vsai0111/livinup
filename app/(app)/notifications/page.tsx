import Link from 'next/link'
import { PAGE_SIZE } from '@/config/app'
import { requireOnboardedUser } from '@/lib/auth'
import { recordEvent } from '@/lib/analytics/events'
import { listNotifications } from '@/lib/community/notifications'
import { getDb } from '@/lib/db'
import { formatRelativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { PageContainer } from '@/components/layout/PageContainer'
import { MarkRead } from '@/components/community/MarkRead'
import { MediaImage } from '@/components/media/MediaImage'
import { Avatar } from '@/components/ui/Avatar'
import type { NotificationView } from '@/types/community'

export const metadata = { title: 'Notifications' }

function describe(entry: NotificationView): string {
  const [first] = entry.actors
  const others = entry.actorCount - 1
  const who =
    others > 0
      ? `${first.displayName} and ${others} ${others === 1 ? 'other' : 'others'}`
      : first.displayName
  switch (entry.type) {
    case 'follow':
      return `${who} started following you`
    case 'like':
      return `${who} liked your post`
    case 'comment':
      return `${who} commented: “${entry.commentSnippet ?? ''}”`
    case 'content_removed':
      return 'One of your posts or comments was removed for breaking the Community Guidelines.'
    case 'report_resolved':
      return 'We reviewed something you reported and took the action we thought appropriate. Thank you.'
  }
}

function hrefFor(entry: NotificationView): string {
  if (entry.type === 'follow') return `/u/${entry.actors[0].username}`
  if (entry.type === 'content_removed' || entry.type === 'report_resolved') {
    return entry.postId ? `/p/${entry.postId}` : '/guidelines'
  }
  return entry.postId ? `/p/${entry.postId}${entry.type === 'comment' ? '#comments' : ''}` : '/home'
}

export default async function NotificationsPage() {
  const session = await requireOnboardedUser('/notifications')
  const db = await getDb()
  const entries = await listNotifications(db, session.id, PAGE_SIZE.notifications)
  const hasUnread = entries.some((entry) => entry.unread)
  if (hasUnread) await recordEvent(db, { userId: session.id, eventType: 'notification_opened' })

  return (
    <PageContainer width="narrow">
      <MarkRead hasUnread={hasUnread} />
      <h1 className="text-ink text-2xl font-semibold tracking-tight">Notifications</h1>

      {entries.length === 0 ? (
        <div className="border-line mt-6 rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="text-ink font-medium">Nothing yet</p>
          <p className="text-ink-muted mt-1 text-sm">
            When people follow you, like or comment on your posts, it shows up here.
          </p>
        </div>
      ) : (
        <ul className="border-line mt-6 divide-y divide-[var(--color-line)] overflow-hidden rounded-2xl border">
          {entries.map((entry) => {
            const system = entry.type === 'content_removed' || entry.type === 'report_resolved'
            return (
              <li key={entry.id}>
                <Link
                  href={hrefFor(entry)}
                  className={cn(
                    'hover:bg-surface-sunken/70 flex items-center gap-3 px-4 py-3.5',
                    entry.unread && 'bg-accent-soft/40',
                  )}
                >
                  {system ? (
                    <span
                      className="bg-surface-sunken text-ink flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                      aria-hidden="true"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      >
                        <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-2.5Z" />
                      </svg>
                    </span>
                  ) : (
                    <Avatar
                      name={entry.actors[0].displayName}
                      mediaId={entry.actors[0].avatarMediaId}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-ink line-clamp-2 text-sm">{describe(entry)}</p>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {formatRelativeTime(entry.createdAt)}
                    </p>
                  </div>
                  {entry.postImageId && !system && (
                    <span className="bg-surface-sunken h-12 w-10 shrink-0 overflow-hidden rounded-md">
                      <MediaImage id={entry.postImageId} size="sm" alt="" />
                    </span>
                  )}
                  {entry.unread && (
                    <span className="bg-accent h-2 w-2 shrink-0 rounded-full" aria-label="Unread" />
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </PageContainer>
  )
}
