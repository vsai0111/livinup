import type { ButtonHTMLAttributes, ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Button and ButtonLink.
 *
 * Two components rather than one polymorphic component on purpose: a control
 * that navigates must render an anchor (so it can be opened in a new tab, and
 * so screen readers announce it as a link), and a control that performs an
 * action must render a button. Collapsing them into `<Button as="a">` is how
 * apps end up with unopenable links and unfocusable buttons.
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

const BASE =
  'inline-flex items-center justify-center gap-2 font-medium whitespace-nowrap ' +
  'transition-[background-color,border-color,color] duration-150 ' +
  'disabled:cursor-not-allowed disabled:opacity-50 rounded-[var(--radius-control)]'

/*
 * `primary` is ink, not the brand green. Green is reserved for statements about
 * the data — a matched preference, a price that has fallen — and a green button
 * next to a green "Great deal" badge makes the interface look like it is
 * selling rather than reporting.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-ink hover:bg-primary-strong shadow-[var(--shadow-subtle)]',
  secondary: 'bg-surface text-ink border border-line-strong hover:bg-surface-sunken',
  ghost: 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
  danger: 'bg-surface text-negative border border-line-strong hover:bg-surface-sunken',
}

const SIZES: Record<ButtonSize, string> = {
  // Minimum 44px touch targets on the md/lg sizes, per WCAG target-size guidance.
  sm: 'h-9 px-3.5 text-sm',
  md: 'h-11 px-4 text-sm',
  lg: 'h-12 px-6 text-[0.9375rem]',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Renders a busy state and blocks interaction. */
  loading?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      disabled={disabled || loading}
      // Communicates the busy state to assistive technology, which a spinner alone does not.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  )
}

export interface ButtonLinkProps {
  href: string
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  children: ReactNode
  prefetch?: boolean
  'aria-label'?: string
}

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  )
}

function Spinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path
        d="M12 2a10 10 0 0 1 10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}
