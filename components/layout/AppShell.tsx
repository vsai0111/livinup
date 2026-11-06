'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { APP_NAME, PRIMARY_NAV, SIDEBAR_COOKIE } from '@/config/app'
import { signOutAction } from '@/app/(auth)/actions'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

/**
 * The signed-in frame: a sidebar on the left and the page beside it.
 *
 * Desktop: the sidebar is always on screen and collapses to an icon rail; the
 * choice is kept in a cookie so the server renders the right width next time.
 * Mobile: the same sidebar is a drawer opened from the top bar.
 *
 * Access control is not done here; layouts call requireUser() first.
 */

const ICONS: Record<string, ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  hanger: (
    <>
      <path d="M10 6.5a2 2 0 1 1 3 1.73c-.62.36-1 .88-1 1.57v.7" />
      <path d="M12 10.5 3.6 16.9a1.5 1.5 0 0 0 .9 2.6h15a1.5 1.5 0 0 0 .9-2.6Z" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3.5 8.5 4.25L12 12 3.5 7.75 12 3.5Z" />
      <path d="m3.5 12 8.5 4.25L20.5 12" />
      <path d="m3.5 16.25 8.5 4.25 8.5-4.25" />
    </>
  ),
  plus: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15L6 16.5Z" />
      <path d="M10 20.5a2 2 0 0 0 4 0" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12.6V4.5a1 1 0 0 1 1-1h8.1a1 1 0 0 1 .7.3l7.4 7.4a1 1 0 0 1 0 1.4l-8.1 8.1a1 1 0 0 1-1.4 0l-7.4-7.4a1 1 0 0 1-.3-.7Z" />
      <circle cx="8.5" cy="8.5" r="1.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z" />
    </>
  ),
  shield: <path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6l7-2.5Z" />,
  logout: (
    <>
      <path d="M15 4.5h3.5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H15" />
      <path d="M10 8l-4 4 4 4M6 12h10" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  collapse: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M15.5 10 13.5 12l2 2" />
    </>
  ),
  expand: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <path d="M9 4.5v15M13.5 10l2 2-2 2" />
    </>
  ),
}

export function NavIcon({
  name,
  className = 'h-[18px] w-[18px]',
}: {
  name: string
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cn('shrink-0', className)}
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

function BrandMark() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="text-accent h-6 w-6 shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 21c0-5 3-8 8-8 0 5-3 8-8 8Zm0 0c0-5-3-8-8-8 0 5 3 8 8 8Zm0-2V9m0 0a3.5 3.5 0 1 1 3.5-3.5A3.5 3.5 0 0 1 12 9Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

export interface ShellUser {
  displayName: string
  username: string | null
  avatarMediaId: string | null
  isAdmin: boolean
}

export function AppShell({
  initialCollapsed,
  user,
  unreadCount,
  children,
}: {
  initialCollapsed: boolean
  user: ShellUser
  unreadCount: number
  children: ReactNode
}) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const profileHref = user.username ? `/u/${user.username}` : '/onboarding'

  const closeDrawer = () => {
    setDrawerOpen(false)
    menuButtonRef.current?.focus()
  }

  useEffect(() => {
    if (!drawerOpen) return
    closeButtonRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setDrawerOpen(false)
      menuButtonRef.current?.focus()
    }
    const desktop = window.matchMedia('(min-width: 48rem)')
    const onBreakpoint = (event: MediaQueryListEvent) => {
      if (event.matches) setDrawerOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    desktop.addEventListener('change', onBreakpoint)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
      desktop.removeEventListener('change', onBreakpoint)
    }
  }, [drawerOpen])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    document.cookie = `${SIDEBAR_COOKIE}=${next ? 'collapsed' : 'expanded'}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`
  }

  const linkClass = (active: boolean) =>
    cn(
      'relative flex h-10 items-center gap-3 rounded-lg px-3 text-[13.5px] transition-colors',
      active
        ? 'bg-surface-sunken text-ink font-semibold'
        : 'text-ink-muted hover:bg-surface-sunken/70 hover:text-ink font-medium',
      collapsed && 'md:justify-center md:px-0',
    )

  const label = (text: string) => (
    <span className={cn('truncate', collapsed && 'md:sr-only')}>{text}</span>
  )

  const badge =
    unreadCount > 0 ? (
      <span
        className={cn(
          'bg-accent text-accent-ink inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10.5px] font-semibold tabular-nums',
          collapsed ? 'md:absolute md:top-1 md:right-1.5' : 'ml-auto',
        )}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
        <span className="sr-only"> unread</span>
      </span>
    ) : null

  const collapseToggle = (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      aria-expanded={!collapsed}
      aria-controls="app-sidebar"
      title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className={cn(
        'text-ink-subtle hover:bg-surface-sunken hover:text-ink hidden items-center justify-center rounded-lg md:inline-flex',
        collapsed ? 'h-10 w-full' : 'ml-auto h-8 w-8',
      )}
    >
      <NavIcon name={collapsed ? 'expand' : 'collapse'} />
    </button>
  )

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-line bg-surface/90 sticky top-0 z-30 border-b backdrop-blur-sm md:hidden">
        <div className="flex h-14 items-center gap-2 px-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
            className="text-ink hover:bg-surface-sunken relative inline-flex h-10 w-10 items-center justify-center rounded-lg"
          >
            <NavIcon name="menu" className="h-5 w-5" />
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="bg-accent absolute top-2 right-2 h-2 w-2 rounded-full"
              />
            )}
          </button>
          <Link href="/home" className="inline-flex items-center gap-2">
            <BrandMark />
            <span className="text-ink text-[17px] font-semibold tracking-tight">{APP_NAME}</span>
          </Link>
          <Link
            href="/create"
            className="bg-primary text-primary-ink ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium"
          >
            <span aria-hidden="true">+</span> Create
          </Link>
        </div>
      </header>

      {drawerOpen && (
        <div
          aria-hidden="true"
          onClick={closeDrawer}
          className="bg-ink/40 fixed inset-0 z-40 md:hidden"
        />
      )}

      <aside
        id="app-sidebar"
        className={cn(
          'border-line bg-surface fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r',
          'transition-[transform,width,visibility] duration-200 ease-out',
          drawerOpen
            ? 'visible translate-x-0 shadow-[var(--shadow-raised)]'
            : 'invisible -translate-x-full',
          'md:visible md:z-30 md:translate-x-0 md:shadow-none',
          collapsed ? 'md:w-[4.25rem]' : 'md:w-60',
        )}
      >
        <div
          className={cn(
            'flex h-16 shrink-0 items-center gap-2 px-4',
            collapsed && 'md:justify-center md:px-0',
          )}
        >
          <Link
            href="/home"
            onClick={() => setDrawerOpen(false)}
            className="inline-flex min-w-0 items-center gap-2"
          >
            <BrandMark />
            <span
              className={cn(
                'text-ink text-[17px] font-semibold tracking-tight',
                collapsed && 'md:sr-only',
              )}
            >
              {APP_NAME}
            </span>
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={closeDrawer}
            aria-label="Close menu"
            className="text-ink-muted hover:bg-surface-sunken hover:text-ink ml-auto inline-flex h-9 w-9 items-center justify-center rounded-lg md:hidden"
          >
            <NavIcon name="close" className="h-5 w-5" />
          </button>
          {!collapsed && collapseToggle}
        </div>

        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3 pb-4">
          {collapsed && <div className="mb-1 hidden md:block">{collapseToggle}</div>}
          <ul className="space-y-0.5">
            {PRIMARY_NAV.map((item) => {
              const active = isActive(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    title={collapsed ? item.label : undefined}
                    className={linkClass(active)}
                  >
                    <NavIcon name={item.icon} />
                    {label(item.label)}
                    {item.href === '/notifications' && badge}
                  </Link>
                </li>
              )
            })}
          </ul>

          <p
            className={cn(
              'text-ink-subtle mt-6 mb-1.5 px-3 text-[11px] font-medium tracking-wide uppercase',
              collapsed && 'md:sr-only',
            )}
          >
            Account
          </p>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/settings"
                onClick={() => setDrawerOpen(false)}
                aria-current={isActive('/settings') ? 'page' : undefined}
                title={collapsed ? 'Settings' : undefined}
                className={linkClass(isActive('/settings'))}
              >
                <NavIcon name="settings" />
                {label('Settings')}
              </Link>
            </li>
            {user.isAdmin && (
              <li>
                <Link
                  href="/admin"
                  onClick={() => setDrawerOpen(false)}
                  aria-current={isActive('/admin') ? 'page' : undefined}
                  title={collapsed ? 'Admin' : undefined}
                  className={linkClass(isActive('/admin'))}
                >
                  <NavIcon name="shield" />
                  {label('Admin')}
                </Link>
              </li>
            )}
            <li>
              <form action={signOutAction}>
                <button
                  type="submit"
                  title={collapsed ? 'Sign out' : undefined}
                  className={cn(linkClass(false), 'w-full')}
                >
                  <NavIcon name="logout" />
                  {label('Sign out')}
                </button>
              </form>
            </li>
          </ul>
        </nav>

        <div className="border-line border-t p-3">
          <Link
            href={profileHref}
            onClick={() => setDrawerOpen(false)}
            title={collapsed ? user.displayName : undefined}
            className={cn(
              'hover:bg-surface-sunken flex items-center gap-3 rounded-lg px-2 py-2',
              collapsed && 'md:justify-center md:px-0',
            )}
          >
            <Avatar name={user.displayName} mediaId={user.avatarMediaId} size="sm" />
            <span className={cn('min-w-0', collapsed && 'md:sr-only')}>
              <span className="text-ink block truncate text-sm font-medium">
                {user.displayName}
              </span>
              <span className="text-ink-subtle block truncate text-xs">
                {user.username ? `@${user.username}` : 'Finish setting up'}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-[padding] duration-200 ease-out',
          collapsed ? 'md:pl-[4.25rem]' : 'md:pl-60',
        )}
      >
        <main id="main" className="flex-1 pb-16">
          {children}
        </main>
      </div>
    </div>
  )
}
