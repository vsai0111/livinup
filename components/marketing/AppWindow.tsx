import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * Chrome for a product mockup.
 *
 * A restrained frame — a title bar with a label, no fake traffic-light dots and
 * no perspective transform. The point is to say "this is the application",
 * which a plain framed panel does perfectly well and a tilted glassy browser
 * does at the cost of legibility.
 */
export function AppWindow({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'border-line bg-surface overflow-hidden rounded-[var(--radius-card)] border',
        'shadow-[var(--shadow-raised)]',
        className,
      )}
    >
      <div className="border-line bg-surface-sunken flex items-center gap-2 border-b px-4 py-2.5">
        <span className="bg-line-strong h-2 w-2 rounded-full" aria-hidden="true" />
        <p className="text-ink-subtle text-xs font-medium">{label}</p>
      </div>
      {children}
    </div>
  )
}
