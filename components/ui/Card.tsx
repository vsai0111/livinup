import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Surface container used for product cards, panels and empty states.
 *
 * Elevation is a prop rather than something each caller assembles from utility
 * classes, so "a card" looks the same everywhere. `raised` is for things that
 * float above the page — the landing-page mockups — not for ordinary panels;
 * shadow used as decoration is what makes an interface feel cluttered.
 */
export function Card({
  className,
  children,
  elevation = 'flat',
  as: Tag = 'div',
}: {
  className?: string
  children: ReactNode
  elevation?: 'flat' | 'subtle' | 'raised'
  as?: 'div' | 'article' | 'section' | 'li'
}) {
  const shadow = {
    flat: '',
    subtle: 'shadow-[var(--shadow-subtle)]',
    raised: 'shadow-[var(--shadow-raised)]',
  }[elevation]

  return (
    <Tag
      className={cn(
        'border-line bg-surface rounded-[var(--radius-card)] border',
        shadow,
        className,
      )}
    >
      {children}
    </Tag>
  )
}
