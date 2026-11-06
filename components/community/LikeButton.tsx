'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { setLikeAction } from '@/app/actions/community'
import { formatCount } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'

/** Optimistic like toggle. Signed-out viewers get a link to sign in instead. */
export function LikeButton({
  postId,
  initialLiked,
  initialCount,
  signedIn,
}: {
  postId: string
  initialLiked: boolean
  initialCount: number
  signedIn: boolean
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [count, setCount] = useState(initialCount)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 20s-7-4.35-7-9.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 7 3.5c0 5.15-7 9.5-7 9.5Z"
        fill={liked ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )

  if (!signedIn) {
    return (
      <Link
        href={`/signin?next=${encodeURIComponent(`/p/${postId}`)}`}
        className="text-ink-muted hover:text-ink inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm"
      >
        {icon}
        <span className="tabular-nums">{formatCount(count)}</span>
        <span className="sr-only">likes. Sign in to like</span>
      </Link>
    )
  }

  const toggle = () => {
    const next = !liked
    setLiked(next)
    setCount((value) => value + (next ? 1 : -1))
    setError(null)
    startTransition(async () => {
      const result = await setLikeAction(postId, next)
      if (!result.ok) {
        setLiked(!next)
        setCount((value) => value + (next ? -1 : 1))
        setError(result.error)
      } else {
        setCount(result.data.likeCount)
      }
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? 'Unlike' : 'Like'}
        className={cn(
          'inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm transition-colors',
          liked ? 'text-[#e0245e]' : 'text-ink-muted hover:text-ink',
        )}
      >
        {icon}
        <span className="tabular-nums">{formatCount(count)}</span>
      </button>
      {error && (
        <span role="alert" className="text-negative text-xs">
          {error}
        </span>
      )}
    </span>
  )
}
