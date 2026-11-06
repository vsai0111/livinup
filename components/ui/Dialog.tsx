'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * A native modal <dialog>.
 *
 * The platform element gives focus trapping, Escape to close and an inert page
 * behind it, which hand-built overlays usually get wrong. Mount it only while
 * open; any way of closing it calls `onClose`.
 */
export function Dialog({
  title,
  description,
  onClose,
  children,
  size = 'md',
}: {
  title: string
  description?: ReactNode
  onClose: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  const widths = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === ref.current) ref.current?.close()
      }}
      aria-labelledby="dialog-title"
      className={cn(
        'bg-surface text-ink m-auto max-h-[90vh] w-[calc(100vw-2rem)] overflow-y-auto rounded-xl p-0',
        'border-line border shadow-[0_24px_64px_-16px_rgb(13_17_23/0.28)] backdrop:bg-black/40 backdrop:backdrop-blur-[2px]',
        widths[size],
      )}
    >
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="dialog-title" className="text-ink text-base font-semibold">
              {title}
            </h2>
            {description && (
              <div className="text-ink-muted mt-1 text-sm leading-relaxed">{description}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="text-ink-subtle hover:bg-surface-sunken hover:text-ink -mt-1 -mr-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  )
}

/** Close the nearest open dialog, for use from inside dialog content. */
export function closeDialogFrom(element: HTMLElement | null): void {
  element?.closest('dialog')?.close()
}
