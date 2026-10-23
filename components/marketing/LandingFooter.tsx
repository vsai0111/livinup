import Link from 'next/link'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { Asterisk } from './Asterisk'
import { Marquee } from './Marquee'

/**
 * Landing footer.
 *
 * Links only to pages that exist. A column of Privacy / Terms / Careers
 * placeholders pointing at "#" is worse than no column: it advertises that the
 * site is unfinished at the moment a visitor is deciding whether to trust it.
 * The affiliate disclosure stays, because it is an obligation, not decoration.
 */
export function LandingFooter() {
  return (
    <footer className="lp-dark relative overflow-hidden">
      <Marquee
        items={[
          APP_TAGLINE,
          'Your digital wardrobe',
          'AI outfit styling',
          'Brands worth discovering',
          'Free to start',
        ]}
      />

      <div className="lp-shell py-14">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-xs">
            <span className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              <Asterisk className="h-5 w-5" color="var(--lp-lime)" />
              {APP_NAME}
            </span>
            <p className="mt-3 text-sm" style={{ color: 'var(--lp-on-dark-muted)' }}>
              {APP_TAGLINE}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-x-12 gap-y-8">
            <nav aria-labelledby="f-product">
              <h2 id="f-product" className="lp-label">
                Product
              </h2>
              <ul className="mt-4 space-y-2.5">
                {[
                  ['#wardrobe', 'Your wardrobe'],
                  ['#styling', 'AI styling'],
                  ['#gaps', 'What is missing'],
                  ['#brands', 'Brands'],
                  ['#stylists', 'Stylists'],
                  ['#how', 'How it works'],
                ].map(([href, label]) => (
                  <li key={href}>
                    <a href={href} className="text-sm transition-opacity hover:opacity-60">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <nav aria-labelledby="f-account">
              <h2 id="f-account" className="lp-label">
                Account
              </h2>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/signup" className="text-sm transition-opacity hover:opacity-60">
                    Create an account
                  </Link>
                </li>
                <li>
                  <Link href="/signin" className="text-sm transition-opacity hover:opacity-60">
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        </div>

        <div
          className="mt-12 flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderTop: '1px solid var(--lp-line-dark)' }}
        >
          <p className="lp-label">
            © {new Date().getFullYear()} {APP_NAME}
          </p>
          <p
            className="max-w-xl text-xs leading-relaxed"
            style={{ color: 'var(--lp-on-dark-muted)' }}
          >
            Stylist booking and brand profiles are in development, and the examples shown on this
            page are illustrations rather than real brands, stylists or customers. {APP_NAME} links
            out to the brands it partners with and may earn a commission; it never changes the price
            you pay, and it never affects what gets recommended to you.
          </p>
        </div>
      </div>
    </footer>
  )
}
