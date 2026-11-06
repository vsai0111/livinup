import Link from 'next/link'
import { APP_NAME } from '@/config/app'

export function SiteFooter() {
  return (
    <footer className="border-line border-t">
      <div className="text-ink-subtle mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. Made in India.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link href="/brands" className="hover:text-ink">
            Brands
          </Link>
          <Link href="/guidelines" className="hover:text-ink">
            Community Guidelines
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/grievance" className="hover:text-ink">
            Grievances
          </Link>
        </nav>
      </div>
    </footer>
  )
}
