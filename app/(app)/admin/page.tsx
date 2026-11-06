import Link from 'next/link'
import { PAGE_SIZE } from '@/config/app'
import { REPORT_REASON_LABELS } from '@/config/community'
import { requireAdmin } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { listQueue, recentActions, suspendedAccounts } from '@/lib/moderation/reports'
import { formatRelativeTime, humanize } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { PageContainer } from '@/components/layout/PageContainer'
import { AdminNav } from '@/components/admin/AdminNav'
import { ResolveReport, Unsuspend } from '@/components/admin/AdminControls'
import { MediaImage } from '@/components/media/MediaImage'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Admin · Reports', robots: { index: false } }

export default async function AdminReportsPage({ searchParams }: PageProps<'/admin'>) {
  await requireAdmin()
  const params = await searchParams
  const status = params.status === 'closed' ? 'closed' : 'open'
  const db = await getDb()
  const [queue, suspended, actions] = await Promise.all([
    listQueue(db, { status, limit: PAGE_SIZE.admin }),
    suspendedAccounts(db),
    recentActions(db, 20),
  ])

  return (
    <PageContainer width="wide">
      <h1 className="text-ink mb-4 text-2xl font-semibold tracking-tight">Admin</h1>
      <AdminNav current="reports" />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="mb-4 flex items-center gap-3">
            <Link
              href="/admin"
              className={cn(
                'text-sm',
                status === 'open' ? 'text-ink font-semibold' : 'text-ink-muted',
              )}
            >
              Open
            </Link>
            <Link
              href="/admin?status=closed"
              className={cn(
                'text-sm',
                status === 'closed' ? 'text-ink font-semibold' : 'text-ink-muted',
              )}
            >
              Closed
            </Link>
          </div>
          {queue.length === 0 ? (
            <p className="text-ink-muted border-line rounded-xl border border-dashed p-8 text-center text-sm">
              {status === 'open' ? 'No open reports.' : 'No closed reports yet.'}
            </p>
          ) : (
            <ul className="space-y-3">
              {queue.map((report) => (
                <li
                  key={report.id}
                  className={cn(
                    'border-line rounded-xl border p-4',
                    report.priority === 'urgent' && 'border-negative/40 bg-negative/5',
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {report.priority === 'urgent' && <Badge tone="negative">Urgent</Badge>}
                    <Badge>{humanize(report.targetType)}</Badge>
                    <span className="text-ink text-sm font-medium">
                      {REPORT_REASON_LABELS[report.reason]}
                    </span>
                    <span className="text-ink-subtle text-xs">
                      {formatRelativeTime(report.createdAt)}
                      {report.reporterUsername && ` · by @${report.reporterUsername}`}
                      {report.duplicateCount > 0 &&
                        ` · ${report.duplicateCount} more report${report.duplicateCount === 1 ? '' : 's'}`}
                    </span>
                  </div>

                  <div className="mt-3 flex gap-3">
                    {report.preview.imageId && (
                      <span className="bg-surface-sunken h-20 w-16 shrink-0 overflow-hidden rounded-md">
                        <MediaImage id={report.preview.imageId} size="sm" alt="Reported image" />
                      </span>
                    )}
                    <div className="min-w-0 text-sm">
                      {report.preview.authorUsername && (
                        <p className="text-ink-muted">
                          By{' '}
                          <Link
                            href={`/u/${report.preview.authorUsername}`}
                            className="text-ink font-medium hover:underline"
                          >
                            @{report.preview.authorUsername}
                          </Link>
                          {report.preview.contentStatus &&
                            report.preview.contentStatus !== 'published' &&
                            report.preview.contentStatus !== 'visible' &&
                            report.preview.contentStatus !== 'active' && (
                              <span className="text-negative">
                                {' '}
                                · {report.preview.contentStatus}
                              </span>
                            )}
                        </p>
                      )}
                      {report.preview.text && (
                        <p className="text-ink mt-1 line-clamp-3 break-words">
                          {report.preview.text}
                        </p>
                      )}
                      {report.targetType === 'post' && (
                        <Link
                          href={`/p/${report.targetId}`}
                          className="text-ink-muted mt-1 inline-block text-xs underline"
                        >
                          Open post
                        </Link>
                      )}
                      {report.details && (
                        <p className="text-ink-muted mt-2 text-xs">Reporter: “{report.details}”</p>
                      )}
                    </div>
                  </div>

                  {report.status === 'open' ? (
                    <div className="mt-4">
                      <ResolveReport
                        reportId={report.id}
                        canRemove={report.targetType !== 'profile'}
                      />
                    </div>
                  ) : (
                    <p className="text-ink-subtle mt-3 text-xs">{humanize(report.status)}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="text-ink text-sm font-semibold">Suspended accounts</h2>
            {suspended.length === 0 ? (
              <p className="text-ink-muted mt-1 text-sm">None.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {suspended.map((account) => (
                  <li key={account.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-ink truncate">
                      {account.username ? `@${account.username}` : account.displayName}
                    </span>
                    <Unsuspend profileId={account.id} />
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="text-ink text-sm font-semibold">Audit log</h2>
            {actions.length === 0 ? (
              <p className="text-ink-muted mt-1 text-sm">No actions yet.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {actions.map((action, index) => (
                  <li key={index} className="text-xs">
                    <span className="text-ink font-medium">{humanize(action.action)}</span>
                    <span className="text-ink-subtle">
                      {' '}
                      · {action.adminUsername ? `@${action.adminUsername}` : 'admin'} ·{' '}
                      {formatRelativeTime(action.createdAt)}
                    </span>
                    <p className="text-ink-muted truncate">{action.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </PageContainer>
  )
}
