import { requireUser } from '@/lib/auth'
import { AppNavDesktop, AppNavMobile } from '@/components/layout/AppNav'
import { Logo } from '@/components/layout/Logo'
import { Container } from '@/components/ui/Container'
import { AnalyticsIdentity } from '@/components/shared/AnalyticsIdentity'

/**
 * Shell for every authenticated page.
 *
 * `requireUser()` here is the real access-control boundary. The proxy also
 * redirects unauthenticated visitors, but only to avoid a pointless render —
 * authorisation is never left to middleware alone, because a misconfigured
 * matcher would then silently expose every page beneath it.
 */
export default async function AppLayout({ children }: LayoutProps<'/'>) {
  const session = await requireUser()

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <AnalyticsIdentity userId={session.id} />

      <header className="border-line bg-surface/85 sticky top-0 z-30 border-b backdrop-blur-sm">
        <Container>
          <div className="flex h-16 items-center justify-between gap-4">
            <Logo href="/home" />
            <AppNavDesktop />
          </div>
        </Container>
      </header>

      {/* pb-24 keeps content clear of the fixed mobile bottom bar. */}
      <main id="main" className="flex-1 pb-24 md:pb-16">
        <Container className="py-8 sm:py-10">{children}</Container>
      </main>

      <AppNavMobile />
    </div>
  )
}
