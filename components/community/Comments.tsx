'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { addCommentAction, deleteCommentAction } from '@/app/actions/community'
import { POST_LIMITS } from '@/config/community'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { formatRelativeTime } from '@/lib/utils/format'
import type { CommentView } from '@/types/community'
import { ReportDialog } from './ReportDialog'
import { VerifiedBadge } from './VerifiedBadge'

/**
 * Comments under a post. Flat, newest last. Text is rendered as text: links
 * are not made clickable (spec C3).
 */
export function Comments({
  postId,
  comments,
  canComment,
}: {
  postId: string
  comments: CommentView[]
  canComment: boolean
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [reporting, setReporting] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!body.trim()) return
    setError(null)
    startTransition(async () => {
      const result = await addCommentAction(postId, body)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setBody('')
      router.refresh()
    })
  }

  const remove = (commentId: string) =>
    startTransition(async () => {
      const result = await deleteCommentAction(commentId, postId)
      if (!result.ok) setError(result.error)
      else router.refresh()
    })

  return (
    <section id="comments" aria-labelledby="comments-heading" className="mt-6">
      <h2 id="comments-heading" className="text-ink text-sm font-semibold">
        Comments{' '}
        {comments.length > 0 && (
          <span className="text-ink-subtle font-normal">· {comments.length}</span>
        )}
      </h2>

      {comments.length === 0 ? (
        <p className="text-ink-muted mt-2 text-sm">No comments yet.</p>
      ) : (
        <ul className="mt-3 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id} className="flex gap-3">
              <Link href={`/u/${comment.author.username}`} className="shrink-0">
                <Avatar
                  name={comment.author.displayName}
                  mediaId={comment.author.avatarMediaId}
                  size="sm"
                />
              </Link>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed">
                  <Link
                    href={`/u/${comment.author.username}`}
                    className="text-ink inline-flex items-center gap-1 font-semibold"
                  >
                    {comment.author.username}
                    {comment.author.verified && <VerifiedBadge className="h-3 w-3" />}
                  </Link>{' '}
                  <span className="text-ink break-words whitespace-pre-line">{comment.body}</span>
                </p>
                <p className="text-ink-subtle mt-0.5 flex gap-3 text-xs">
                  <span>{formatRelativeTime(comment.createdAt)}</span>
                  {comment.canDelete && (
                    <button
                      type="button"
                      onClick={() => remove(comment.id)}
                      disabled={pending}
                      className="hover:text-negative"
                    >
                      Delete
                    </button>
                  )}
                  {!comment.canDelete && canComment && (
                    <button
                      type="button"
                      onClick={() => setReporting(comment.id)}
                      className="hover:text-ink"
                    >
                      Report
                    </button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form
          className="mt-5 flex items-start gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <label htmlFor="comment-body" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={POST_LIMITS.commentLength}
            rows={1}
            placeholder="Add a comment…"
            className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle min-h-10 flex-1 resize-y rounded-lg border px-3 py-2 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            className="h-10"
            loading={pending}
            disabled={!body.trim()}
          >
            Post
          </Button>
        </form>
      )}
      {error && (
        <p role="alert" className="text-negative mt-2 text-sm">
          {error}
        </p>
      )}

      {reporting && (
        <ReportDialog
          targetType="comment"
          targetId={reporting}
          onClose={() => setReporting(null)}
        />
      )}
    </section>
  )
}
