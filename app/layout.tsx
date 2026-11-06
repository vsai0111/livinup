import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/config/app'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'], display: 'swap' })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'], display: 'swap' })

/** Absolute base for Open Graph images and canonical URLs. */
function siteBase(): URL {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return new URL(configured)
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return new URL(`https://${vercel}`)
  return new URL('http://localhost:3000')
}

export const metadata: Metadata = {
  metadataBase: siteBase(),
  title: { default: `${APP_NAME} · ${APP_TAGLINE}`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  robots: { index: true, follow: true },
  openGraph: { siteName: APP_NAME, type: 'website', locale: 'en_IN' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Not capping maximumScale: preventing pinch-zoom breaks the page for anyone
  // who needs to magnify it.
  themeColor: '#ffffff',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
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
