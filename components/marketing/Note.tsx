import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Handwritten marginalia with a hooked arrow.
 *
 * Decoration, so the whole thing is hidden from assistive technology — the
 * point it makes is always made properly by the copy it points at. If that
 * stops being true, the note is doing work it should not be doing.
 */
export function Note({
  children,
  tone = 'coral',
  flip = false,
  className,
}: {
  children: ReactNode
  tone?: 'coral' | 'lime'
  flip?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none inline-flex items-end gap-1.5', className)}
    >
      {flip && <Arrow flip tone={tone} />}
      <span className={cn('lp-note', tone === 'lime' && 'lp-note-lime')}>{children}</span>
      {!flip && <Arrow tone={tone} />}
    </span>
  )
}

function Arrow({ flip = false, tone }: { flip?: boolean; tone: 'coral' | 'lime' }) {
  return (
    <svg
      viewBox="0 0 48 40"
      className="h-8 w-9 shrink-0"
      style={{
        color: tone === 'lime' ? 'var(--lp-lime)' : 'var(--lp-coral)',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M44 4C40 18 30 30 14 34" />
      <path d="M22 33.5 13.5 34.5 16 26" />
    </svg>
  )
}
