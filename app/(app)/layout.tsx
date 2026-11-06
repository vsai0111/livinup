import { requireUser } from '@/lib/auth'
import { SignedInShell } from '@/components/layout/SignedInShell'

/**
 * Shell for every signed-in page.
 *
 * `requireUser()` here is the access-control boundary for the group; pages
 * that need a finished profile call `requireOnboardedUser()` as well. The proxy
 * also redirects unauthenticated visitors, but only to save a wasted render.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireUser()
  return <SignedInShell session={session}>{children}</SignedInShell>
}
