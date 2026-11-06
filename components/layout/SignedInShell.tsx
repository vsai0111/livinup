import { cookies } from 'next/headers'
import type { ReactNode } from 'react'
import { SIDEBAR_COOKIE } from '@/config/app'
import { unreadCount } from '@/lib/community/notifications'
import { getDb } from '@/lib/db'
import type { SessionUser } from '@/types/user'
import { AnalyticsIdentity } from '@/components/shared/AnalyticsIdentity'
import { AppShell } from './AppShell'

/** The sidebar frame for a signed-in user, with their unread count. */
export async function SignedInShell({
  session,
  children,
}: {
  session: SessionUser
  children: ReactNode
}) {
  const [cookieStore, db] = await Promise.all([cookies(), getDb()])
  const unread = await unreadCount(db, session.id)

  return (
    <AppShell
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === 'collapsed'}
      unreadCount={unread}
      user={{
        displayName: session.profile.displayName,
        username: session.profile.username,
        avatarMediaId: session.profile.avatarMediaId,
        isAdmin: session.profile.role === 'admin',
      }}
    >
      <AnalyticsIdentity userId={session.id} />
      {children}
    </AppShell>
  )
}
