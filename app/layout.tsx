import type { Metadata, Viewport } from 'next'
import { Caveat, Geist, Geist_Mono } from 'next/font/google'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/config/app'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

// Handwritten marginalia on the landing page. Decorative only — every note it
// sets is aria-hidden, so a failed font load costs nothing but the flourish.
const caveat = Caveat({ variable: '--font-caveat', subsets: ['latin'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  robots: { index: true, follow: true },
  verification: {
    // Site-ownership proof for the Admitad/Mitgo publisher account. It has to
    // be served from the root layout so it is present on the homepage, which is
    // the document their crawler fetches.
    //
    // Not a secret: a verification token is public by design, and is worthless
    // to anyone who does not already control the DNS for livinup.in.
    other: { 'mitgo-verification': '7344ff2a-acfe-4121-ae8e-73012bd90aa3' },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not capping maximumScale: preventing pinch-zoom breaks the page for anyone
  // who needs to magnify it.
  // One theme, so one colour. Offering a dark themeColor the stylesheet does
  // not implement gives mobile browsers a chrome that clashes with the page.
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${caveat.variable} h-full`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main"
          className="sr-only-focusable bg-primary text-primary-ink absolute top-4 left-4 z-50 rounded-[var(--radius-control)] px-4 py-2 text-sm font-medium"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  )
}
