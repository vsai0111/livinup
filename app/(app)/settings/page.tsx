import { requireOnboardedUser, getAuthProvider } from '@/lib/auth'
import { listBlocked } from '@/lib/community/blocks'
import { getDb } from '@/lib/db'
import { PageContainer } from '@/components/layout/PageContainer'
import {
  DeletePanel,
  PasswordPanel,
  PrivacyPanel,
  ProfilePanel,
} from '@/components/settings/SettingsPanels'

export const metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await requireOnboardedUser('/settings')
  const db = await getDb()
  const blocked = await listBlocked(db, session.id)

  // Accounts that only ever used Google have no password to change.
  let hasPassword = true
  if (getAuthProvider().id === 'local') {
    hasPassword = true
  } else {
    const rows = await db
      .query<{ has_password: boolean }>(
        `select (encrypted_password is not null and encrypted_password <> '') as has_password
         from auth.users where id = $1`,
        [session.id],
      )
      .catch(() => [{ has_password: true }])
    hasPassword = rows[0]?.has_password ?? true
  }

  return (
    <PageContainer width="narrow">
      <h1 className="text-ink mb-6 text-2xl font-semibold tracking-tight">Settings</h1>
      <div className="space-y-5">
        <ProfilePanel
          displayName={session.profile.displayName}
          username={session.profile.username!}
          bio={session.profile.bio ?? ''}
          avatarMediaId={session.profile.avatarMediaId}
        />
        <PrivacyPanel exploreVisible={session.profile.exploreVisible} blocked={blocked} />
        <PasswordPanel email={session.email} hasPassword={hasPassword} />
        <DeletePanel username={session.profile.username!} />
      </div>
    </PageContainer>
  )
}
