import type { ElementType, ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The one horizontal measure in the product.
 *
 * Every page — marketing and application alike — puts its content inside this,
 * so the logo, the hero headline and a product grid all start on the same
 * vertical line. Pages that invent their own `max-w-*` are how a site ends up
 * with three slightly different gutters that nobody can quite see but everybody
 * can feel.
 *
 * `narrow` is for reading measures (auth, onboarding, prose) — roughly 65
 * characters, past which the eye loses the start of the next line.
 */
export type ContainerWidth = 'narrow' | 'content' | 'default' | 'wide'

const WIDTHS: Record<ContainerWidth, string> = {
  narrow: 'max-w-md',
  content: 'max-w-3xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
}

export function Container({
  width = 'default',
  className,
  children,
  as: Tag = 'div',
}: {
  width?: ContainerWidth
  className?: string
  children: ReactNode
  as?: ElementType
}) {
  return (
    <Tag className={cn('mx-auto w-full px-5 sm:px-6 lg:px-8', WIDTHS[width], className)}>
      {children}
    </Tag>
  )
}
