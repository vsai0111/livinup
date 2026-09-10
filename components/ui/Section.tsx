import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'
import { Container, type ContainerWidth } from './Container'

/**
 * A landing-page band.
 *
 * Owns the vertical rhythm and the optional full-bleed background, so sections
 * can be reordered without their spacing coming apart. The background sits on
 * the <section> while the content stays inside a Container — that is what lets
 * a tinted band run edge to edge while its text stays on the page's measure.
 */
export function Section({
  id,
  labelledBy,
  tone = 'default',
  size = 'md',
  bordered = false,
  width = 'default',
  className,
  children,
}: {
  id?: string
  /** id of the heading this section is named by, for assistive technology. */
  labelledBy?: string
  tone?: 'default' | 'sunken'
  size?: 'sm' | 'md' | 'lg'
  bordered?: boolean
  width?: ContainerWidth
  className?: string
  children: ReactNode
}) {
  const padding = {
    sm: 'py-12 sm:py-16',
    md: 'py-16 sm:py-24',
    lg: 'py-20 sm:py-28',
  }[size]

  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        padding,
        tone === 'sunken' && 'bg-surface-sunken',
        bordered && 'border-line border-t',
        className,
      )}
    >
      <Container width={width}>{children}</Container>
    </section>
  )
}

/**
 * The heading block that opens a section: eyebrow, title, supporting line.
 *
 * Centred by default because most landing sections are; `align="start"` for the
 * ones that sit beside a visual.
 */
export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  align = 'center',
  className,
}: {
  id: string
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  align?: 'center' | 'start'
  className?: string
}) {
  return (
    <div
      className={cn(align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl', className)}
    >
      {eyebrow && (
        <p className="text-accent text-xs font-semibold tracking-[0.14em] uppercase">{eyebrow}</p>
      )}
      <h2
        id={id}
        className={cn(
          'text-ink text-3xl font-semibold text-balance sm:text-4xl',
          eyebrow && 'mt-3',
        )}
      >
        {title}
      </h2>
      {description && (
        <p className="text-ink-muted mt-4 text-base leading-relaxed text-pretty sm:text-lg">
          {description}
        </p>
      )}
    </div>
  )
}
