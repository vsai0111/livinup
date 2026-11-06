'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/** A small "more" menu: a button that opens a list of actions. */
export function Menu({
  label,
  items,
  align = 'right',
}: {
  label: string
  items: Array<{ label: string; onSelect: () => void; danger?: boolean; hidden?: boolean }>
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = items.filter((item) => !item.hidden)
  if (visible.length === 0) return null

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="text-ink-muted hover:bg-surface-sunken hover:text-ink inline-flex h-9 w-9 items-center justify-center rounded-lg"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(
            'border-line bg-surface absolute z-20 mt-1 min-w-44 rounded-xl border p-1 shadow-[var(--shadow-raised)]',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {visible.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
                className={cn(
                  'hover:bg-surface-sunken w-full rounded-lg px-3 py-2 text-left text-sm',
                  item.danger ? 'text-negative' : 'text-ink',
                )}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type MenuNode = ReactNode
