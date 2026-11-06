import { getSessionUser } from '@/lib/auth'
import { PublicShell } from '@/components/layout/PublicShell'
import { SignedInShell } from '@/components/layout/SignedInShell'

/**
 * Public pages: profiles, posts, brands, legal. Readable by anyone (spec P5),
 * framed by the sidebar for signed-in members and by a simple header otherwise.
 */
export default async function PublicLayout({ children }: LayoutProps<'/'>) {
  const session = await getSessionUser()
  if (session?.profile.username) return <SignedInShell session={session}>{children}</SignedInShell>
  return <PublicShell>{children}</PublicShell>
}
