import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * The heading block every authenticated page opens with.
 *
 * Exists so that "where am I" is answered identically on Home, Saved,
 * Preferences and Profile. `actions` sits on the same baseline as the title on
 * wide screens and wraps beneath it on narrow ones, rather than being squeezed.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-ink text-2xl font-semibold sm:text-[1.75rem]">{title}</h1>
        {description && (
          <p className="text-ink-muted mt-1.5 max-w-2xl text-sm leading-relaxed text-pretty">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
