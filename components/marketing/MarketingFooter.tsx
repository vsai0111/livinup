import Link from 'next/link'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { Container } from '@/components/ui/Container'
import { Logo } from '@/components/layout/Logo'

/**
 * Landing-page footer.
 *
 * Links only to pages that exist. A column of Privacy / Terms / Careers
 * placeholders pointing at "#" is worse than no column: it advertises that the
 * site is unfinished at the exact moment a visitor is deciding whether to trust
 * it. The affiliate disclosure stays, because it is a real obligation rather
 * than decoration.
 */
export function MarketingFooter() {
  return (
    <footer className="border-line bg-surface-sunken border-t">
      <Container className="py-12 sm:py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="text-ink-muted mt-3 text-sm">{APP_TAGLINE}</p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-2">
            <nav aria-labelledby="footer-product">
              <h2 id="footer-product" className="text-ink text-sm font-semibold">
                Product
              </h2>
              <ul className="mt-3 space-y-2.5">
                {[
                  { href: '#how-it-works', label: 'How it works' },
                  { href: '#discover', label: 'Discover' },
                  { href: '#price-intelligence', label: 'Price intelligence' },
                  { href: '#personalization', label: 'Personalization' },
                ].map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-ink-muted hover:text-ink text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-labelledby="footer-account">
              <h2 id="footer-account" className="text-ink text-sm font-semibold">
                Account
              </h2>
              <ul className="mt-3 space-y-2.5">
                <li>
                  <Link href="/signup" className="text-ink-muted hover:text-ink text-sm">
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link href="/signin" className="text-ink-muted hover:text-ink text-sm">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div className="border-line mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-ink-subtle text-xs">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
          <p className="text-ink-subtle max-w-xl text-xs leading-relaxed">
            {APP_NAME} links out to merchants and may earn a commission. It never changes the price
            you pay, and it never affects how products are ranked.
          </p>
        </div>
      </Container>
    </footer>
  )
}
