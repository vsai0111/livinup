'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { APP_NAME } from '@/config/app'
import { Asterisk } from './Asterisk'

/**
 * Floating pill navigation.
 *
 * The wordmark trades places with the brand mark once the page moves — both
 * elements are always rendered, stacked in the same grid cell, and cross-faded,
 * so the pill never changes width and nothing around it reflows.
 *
 * The menu is a full-screen panel rather than a dropdown: at this type scale a
 * dropdown would be a postage stamp. It is unmounted when closed so its links
 * leave the tab order, closes on Escape, and locks body scroll while open.
 */

const LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#feed', label: 'The feed' },
  { href: '#price', label: 'Price intelligence' },
  { href: '#why', label: `Why ${APP_NAME}` },
]

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // Without this the page scrolls behind the panel on every wheel event.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <header className="lp-nav" data-scrolled={scrolled}>
        <div className="lp-nav-pill">
          <button
            type="button"
            className="lp-menu-toggle"
            aria-expanded={open}
            aria-controls="lp-menu"
            onClick={() => setOpen((value) => !value)}
          >
            <span className="lp-menu-bars" aria-hidden="true">
              <span />
              <span />
            </span>
            {open ? 'Close' : 'Menu'}
          </button>

          <Link href="/" className="lp-nav-brand" aria-label={`${APP_NAME} home`}>
            <span className="lp-nav-word text-[1.0625rem] font-semibold tracking-tight">
              {APP_NAME}
            </span>
            <span className="lp-nav-mark" aria-hidden="true">
              <Asterisk className="h-5 w-5" />
            </span>
          </Link>

          <div className="flex items-center gap-1.5">
            <Link href="/signin" className="lp-nav-btn lp-nav-ghost lp-nav-signin">
              Sign in
            </Link>
            <Link href="/signup" className="lp-nav-btn lp-nav-cta">
              Get started
            </Link>
          </div>
        </div>
      </header>

      {open && (
        <div id="lp-menu" className="lp-menu">
          <nav aria-label="Sections">
            {LINKS.map((link) => (
              <a key={link.href} href={link.href} onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex flex-wrap items-center gap-3 pt-8">
            <Link href="/signup" className="lp-btn lp-btn-lime" onClick={() => setOpen(false)}>
              Get started
            </Link>
            <Link href="/signin" className="lp-btn lp-btn-outline" onClick={() => setOpen(false)}>
              Sign in
            </Link>
          </div>
        </div>
      )}
    </>
  )
}
