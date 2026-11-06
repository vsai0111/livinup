'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setBlockAction } from '@/app/actions/community'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Menu } from './Menu'
import { ReportDialog } from './ReportDialog'

export function ProfileMenu({
  profileId,
  username,
  blocking,
}: {
  profileId: string
  username: string
  blocking: boolean
}) {
  const router = useRouter()
  const [dialog, setDialog] = useState<null | 'report' | 'block'>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const setBlock = (blocked: boolean) =>
    startTransition(async () => {
      const result = await setBlockAction(profileId, blocked)
      if (!result.ok) {
        setError(result.error)
        return
      }
      setDialog(null)
      router.refresh()
    })

  return (
    <>
      <Menu
        label="Account options"
        items={[
          { label: 'Report account', onSelect: () => setDialog('report') },
          blocking
            ? { label: `Unblock @${username}`, onSelect: () => setBlock(false) }
            : { label: `Block @${username}`, onSelect: () => setDialog('block'), danger: true },
        ]}
      />
      {dialog === 'report' && (
        <ReportDialog targetType="profile" targetId={profileId} onClose={() => setDialog(null)} />
      )}
      {dialog === 'block' && (
        <Dialog
          title={`Block @${username}?`}
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
            <Button variant="danger" loading={pending} onClick={() => setBlock(true)}>
              Block
            </Button>
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
