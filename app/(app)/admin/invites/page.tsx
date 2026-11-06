import { serverEnv } from '@/config/env.server'
import { requireAdmin } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { listInvites } from '@/lib/moderation/invites'
import { formatDate } from '@/lib/utils/format'
import { PageContainer } from '@/components/layout/PageContainer'
import { AdminNav } from '@/components/admin/AdminNav'
import { CreateInviteForm, DisableInvite } from '@/components/admin/AdminControls'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Admin · Invite codes', robots: { index: false } }

export default async function AdminInvitesPage() {
  await requireAdmin()
  const db = await getDb()
  const invites = await listInvites(db)
  const required = serverEnv().LIVINUP_REQUIRE_INVITE

  return (
    <PageContainer width="wide">
      <h1 className="text-ink mb-4 text-2xl font-semibold tracking-tight">Admin</h1>
      <AdminNav current="invites" />

      <p className="text-ink-muted mb-5 text-sm">
        Sign-up{' '}
        {required ? (
          <strong className="text-ink">requires an invite code</strong>
        ) : (
          'is open; invite codes are optional'
        )}
        . Set <code className="font-mono text-xs">LIVINUP_REQUIRE_INVITE=1</code> to require one
        during the closed beta.
      </p>

      <section className="border-line rounded-2xl border p-5">
        <h2 className="text-ink mb-4 text-base font-semibold">Create a code</h2>
        <CreateInviteForm />
      </section>

      <section className="mt-8">
        <h2 className="text-ink text-base font-semibold">Codes</h2>
        {invites.length === 0 ? (
          <p className="text-ink-muted mt-2 text-sm">No codes yet.</p>
        ) : (
          <ul className="border-line mt-3 divide-y divide-[var(--color-line)] rounded-2xl border">
            {invites.map((invite) => {
              const { expired } = invite
              const usable = !invite.disabled && !expired && invite.uses < invite.maxUses
              return (
                <li
                  key={invite.code}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <code className="text-ink font-mono text-sm font-semibold">{invite.code}</code>{' '}
                    {usable ? (
                      <Badge tone="positive">Active</Badge>
                    ) : (
                      <Badge>
                        {invite.disabled ? 'Disabled' : expired ? 'Expired' : 'Used up'}
                      </Badge>
                    )}
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {invite.uses}/{invite.maxUses} used · created {formatDate(invite.createdAt)}
                      {invite.expiresAt && ` · expires ${formatDate(invite.expiresAt)}`}
                    </p>
                  </div>
                  {usable && <DisableInvite code={invite.code} />}
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}
