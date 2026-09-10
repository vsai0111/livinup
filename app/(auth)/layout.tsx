import Link from 'next/link'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { Logo } from '@/components/layout/Logo'
import { Container } from '@/components/ui/Container'

/**
 * Auth shell.
 *
 * A single centred card on the same white ground as the rest of the product, so
 * signing up does not feel like leaving the site. The logo is a link home
 * rather than decoration — someone who arrived at sign-up by accident needs a
 * way back that is not the browser button.
 */
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-line border-b">
        <Container>
          <div className="flex h-16 items-center justify-between">
            <Logo />
            <Link href="/" className="text-ink-muted hover:text-ink text-sm font-medium">
              &larr; Back to {APP_NAME}
            </Link>
          </div>
        </Container>
      </header>

      <main id="main" className="flex flex-1 flex-col justify-center py-12 sm:py-16">
        <Container width="narrow">
          <div className="border-line bg-surface rounded-[var(--radius-card)] border p-6 shadow-[var(--shadow-subtle)] sm:p-8">
            {children}
          </div>

          <p className="text-ink-subtle mt-6 text-center text-xs">{APP_TAGLINE}</p>
        </Container>
      </main>
    </div>
  )
}
