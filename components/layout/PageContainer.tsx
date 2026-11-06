import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** Content width for signed-in pages. */
export function PageContainer({
  children,
  width = 'default',
  className,
}: {
  children: ReactNode
  width?: 'narrow' | 'default' | 'wide'
  className?: string
}) {
  const widths = { narrow: 'max-w-2xl', default: 'max-w-5xl', wide: 'max-w-7xl' }
  return (
    <div
      className={cn('mx-auto w-full px-4 py-6 sm:px-6 sm:py-8 lg:px-8', widths[width], className)}
    >
      {children}
    </div>
  )
}
