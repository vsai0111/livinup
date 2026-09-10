'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/layout/Logo'
import { Container } from '@/components/ui/Container'
import { ButtonLink } from '@/components/ui/Button'

/**
 * Landing-page navigation.
 *
 * Every destination is a section of this page, so the links are in-page
 * anchors. Inventing /about and /pricing routes to fill a navbar produces dead
 * links, which reads as far less finished than a short menu.
 *
 * The mobile menu is a real disclosure: `aria-expanded` and `aria-controls` on
 * the trigger, Escape to close, and the panel unmounted rather than hidden so
 * its links leave the tab order entirely when it is shut.
 */

const LINKS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#discover', label: 'Discover' },
  { href: '#price-intelligence', label: 'Price intelligence' },
  { href: '#personalization', label: 'Personalization' },
]

export function MarketingNav() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="border-line bg-surface/85 sticky top-0 z-40 border-b backdrop-blur-sm">
      <Container>
        <div className="flex h-16 items-center justify-between gap-6">
          <Logo />

          <nav aria-label="Sections" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-ink-muted hover:text-ink hover:bg-surface-sunken rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-1.5">
            <ButtonLink href="/signin" variant="ghost" size="sm" className="hidden sm:inline-flex">
              Sign in
            </ButtonLink>
            <ButtonLink href="/signup" size="sm">
              Get started
            </ButtonLink>

            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls="marketing-menu"
              className="text-ink-muted hover:bg-surface-sunken hover:text-ink -mr-1.5 inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-control)] lg:hidden"
            >
              <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
              <MenuIcon open={open} />
            </button>
          </div>
        </div>
      </Container>

      {open && (
        <div id="marketing-menu" className="border-line bg-surface border-t lg:hidden">
          <Container className="py-3">
            <nav aria-label="Sections">
              <ul className="flex flex-col">
                {LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className="text-ink-muted hover:text-ink block rounded-[var(--radius-control)] px-2 py-3 text-sm font-medium"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li className="border-line mt-2 border-t pt-2 sm:hidden">
                  <Link
                    href="/signin"
                    onClick={() => setOpen(false)}
                    className="text-ink-muted hover:text-ink block rounded-[var(--radius-control)] px-2 py-3 text-sm font-medium"
                  >
                    Sign in
                  </Link>
                </li>
              </ul>
            </nav>
          </Container>
        </div>
      )}
    </header>
  )
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {open ? <path d="m6 6 12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
    </svg>
  )
}
