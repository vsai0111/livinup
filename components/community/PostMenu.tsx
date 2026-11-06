'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deletePostAction, editCaptionAction, setBlockAction } from '@/app/actions/community'
import { POST_LIMITS } from '@/config/community'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from './Menu'
import { ReportDialog } from './ReportDialog'

/** Post actions: edit caption and delete (author); report and block (others). */
export function PostMenu({
  postId,
  authorId,
  authorUsername,
  caption,
  isAuthor,
  signedIn,
}: {
  postId: string
  authorId: string
  authorUsername: string
  caption: string
  isAuthor: boolean
  signedIn: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'edit' | 'delete' | 'report' | 'block'>(null)
  const [draft, setDraft] = useState(caption)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const run = (work: () => Promise<{ ok: boolean; error?: string }>, after: () => void) =>
    startTransition(async () => {
      setError(null)
      const result = await work()
      if (!result.ok) setError(result.error ?? 'That did not work.')
      else after()
    })

  if (!signedIn) return null

  return (
    <>
      <Menu
        label="Post options"
        items={[
          { label: 'Edit caption', onSelect: () => setDialog('edit'), hidden: !isAuthor },
          {
            label: 'Delete post',
            onSelect: () => setDialog('delete'),
            danger: true,
            hidden: !isAuthor,
          },
          { label: 'Report post', onSelect: () => setDialog('report'), hidden: isAuthor },
          {
            label: `Block @${authorUsername}`,
            onSelect: () => setDialog('block'),
            danger: true,
            hidden: isAuthor,
          },
        ]}
      />

      {dialog === 'edit' && (
        <Dialog title="Edit caption" onClose={() => setDialog(null)}>
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={POST_LIMITS.captionLength}
            rows={5}
            aria-label="Caption"
            className="border-line-strong bg-surface text-ink w-full rounded-lg border px-3.5 py-2.5 text-sm"
          />
          {error && (
            <p role="alert" className="text-negative mt-2 text-sm">
              {error}
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Button
              loading={pending}
              onClick={() =>
                run(
                  () => editCaptionAction(postId, draft),
                  () => {
                    setDialog(null)
                    router.refresh()
                  },
                )
              }
            >
              Save
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}

      {dialog === 'delete' && (
        <Dialog
          title="Delete this post?"
          description="The post and its photos are removed for everyone. Your wardrobe is not affected."
          onClose={() => setDialog(null)}
          size="sm"
        >
          {error && (
            <p role="alert" className="text-negative mb-3 text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                run(
                  () => deletePostAction(postId),
                  () => {
                    router.push('/home')
                    router.refresh()
                  },
                )
              }
            >
              Delete post
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}

      {dialog === 'block' && (
        <Dialog
          title={`Block @${authorUsername}?`}
          description="You will not see each other’s posts, profiles or comments, and neither of you can follow or interact with the other. They are not told."
          onClose={() => setDialog(null)}
          size="sm"
        >
          {error && (
            <p role="alert" className="text-negative mb-3 text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="danger"
              loading={pending}
              onClick={() =>
                run(
                  () => setBlockAction(authorId, true),
                  () => {
                    router.push('/home')
                    router.refresh()
                  },
                )
              }
            >
              Block
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}

      {dialog === 'report' && (
        <ReportDialog targetType="post" targetId={postId} onClose={() => setDialog(null)} />
      )}
    </>
  )
}
