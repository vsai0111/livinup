'use client'

import { useState } from 'react'
import { recordShareAction } from '@/app/actions/community'
import { cn } from '@/lib/utils/cn'

/** Native share sheet where available; otherwise copy the link. */
export function ShareButton({
  path,
  title,
  kind,
  className,
  label = 'Share',
}: {
  path: string
  title: string
  kind: 'post' | 'profile'
  className?: string
  label?: string
}) {
  const [copied, setCopied] = useState(false)

  const share = async () => {
    const url = new URL(path, window.location.origin).toString()
    void recordShareAction(kind)
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // Cancelled, or not allowed here: fall back to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <button
      type="button"
      onClick={() => void share()}
      aria-label={label ? undefined : copied ? 'Link copied' : 'Share'}
      className={cn(
        'text-ink-muted hover:text-ink inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm',
        className,
      )}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 15V4m0 0L8 8m4-4 4 4" />
        <path d="M6 12v6.5a1.5 1.5 0 0 0 1.5 1.5h9a1.5 1.5 0 0 0 1.5-1.5V12" />
      </svg>
      <span aria-live="polite">{copied ? 'Link copied' : label}</span>
    </button>
  )
}
