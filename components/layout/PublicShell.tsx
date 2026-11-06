import Link from 'next/link'
import type { ReactNode } from 'react'
import { APP_NAME } from '@/config/app'
import { ButtonLink } from '@/components/ui/Button'
import { Logo } from './Logo'
import { SiteFooter } from './SiteFooter'

/**
 * Frame for public pages. Signed-out visitors see Sign in / Join; the landing
 * page passes `signedIn` so members get a way back into the app instead.
 */
export function PublicShell({
  children,
  signedIn = false,
}: {
  children: ReactNode
  signedIn?: boolean
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-line bg-surface/90 sticky top-0 z-30 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <Logo />
          <nav aria-label="Main" className="ml-4 hidden sm:block">
            <Link href="/brands" className="text-ink-muted hover:text-ink text-sm font-medium">
              Brands
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {signedIn ? (
              <ButtonLink href="/home" size="sm">
                Open app
              </ButtonLink>
            ) : (
              <>
                <ButtonLink href="/signin" variant="ghost" size="sm">
                  Sign in
                </ButtonLink>
                <ButtonLink href="/signup" size="sm">
                  Join {APP_NAME}
                </ButtonLink>
              </>
            )}
          </div>
        </div>
      </header>
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
