'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { PRIMARY_NAV } from '@/config/app'
import { cn } from '@/lib/utils/cn'

/**
 * Primary navigation.
 *
 * One component renders both the desktop top nav and the mobile bottom bar, so
 * the destinations can never drift apart between breakpoints. The current page
 * is marked with `aria-current="page"` rather than colour alone.
 *
 * Icons appear only on the mobile bar, where they carry real weight in a 5-up
 * row of tiny labels. On desktop the labels have room to speak for themselves,
 * and a row of icons beside them is decoration that makes the header noisier
 * without making it clearer.
 */

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  bookmark: <path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-3.7L5.5 20.5v-16a1 1 0 0 1 1-1Z" />,
  sliders: (
    <>
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" />
      <circle cx="16" cy="8" r="2" />
      <circle cx="10" cy="16" r="2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    </>
  ),
}

function NavIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name]}
    </svg>
  )
}

function useIsActive() {
  const pathname = usePathname()
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Onboarding is a single task with its own exits ("skip this question", "skip
 * setup entirely"). Five competing destinations beside it is the distraction
 * the flow is designed to avoid, so the nav stands down until it is finished.
 */
function useHideNav() {
  const pathname = usePathname()
  return pathname === '/onboarding' || pathname.startsWith('/onboarding/')
}

export function AppNavDesktop() {
  const isActive = useIsActive()
  const hidden = useHideNav()

  if (hidden) return null

  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-0.5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 items-center rounded-[var(--radius-control)] px-3 text-sm transition-colors',
                  active
                    ? 'bg-surface-sunken text-ink font-semibold'
                    : 'text-ink-muted hover:bg-surface-sunken hover:text-ink font-medium',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function AppNavMobile() {
  const isActive = useIsActive()
  const hidden = useHideNav()

  if (hidden) return null

  return (
    <nav
      aria-label="Main"
      className="border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item.href)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] transition-colors',
                  active ? 'text-ink font-semibold' : 'text-ink-subtle font-medium',
                )}
              >
                {/* A bar rather than colour alone, so the current tab is still
                    obvious to someone who cannot separate the two greys. */}
                {active && (
                  <span
                    aria-hidden="true"
                    className="bg-ink absolute inset-x-4 top-0 h-0.5 rounded-full"
                  />
                )}
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
