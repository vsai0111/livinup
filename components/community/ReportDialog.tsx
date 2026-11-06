'use client'

import { useState, useTransition } from 'react'
import { reportAction } from '@/app/actions/community'
import { REPORT_REASONS, REPORT_REASON_LABELS, type ReportReason } from '@/config/community'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { cn } from '@/lib/utils/cn'

/** Report a post, comment or profile. */
export function ReportDialog({
  targetType,
  targetId,
  onClose,
}: {
  targetType: 'post' | 'comment' | 'profile'
  targetId: string
  onClose: () => void
}) {
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    if (!reason) {
      setError('Choose the reason that fits best.')
      return
    }
    startTransition(async () => {
      const result = await reportAction({ targetType, targetId, reason, details })
      if (!result.ok) setError(result.error)
      else setDone(true)
    })
  }

  return (
    <Dialog
      title={
        done
          ? 'Thanks for telling us'
          : `Report this ${targetType === 'profile' ? 'account' : targetType}`
      }
      onClose={onClose}
      size="md"
    >
      {done ? (
        <div className="space-y-4">
          <p className="text-ink-muted text-sm leading-relaxed">
            Our team will review it. You will get a notification when we have. The account you
            reported is not told who reported it.
          </p>
          <Button onClick={onClose}>Close</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="sr-only">Reason</legend>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((value) => (
                <label
                  key={value}
                  className={cn(
                    'border-line hover:bg-surface-sunken flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm',
                    'has-checked:border-ink has-checked:bg-surface-sunken',
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-[var(--color-primary)]"
                  />
                  {REPORT_REASON_LABELS[value]}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1.5">
            <label htmlFor="report-details" className="text-ink block text-sm font-medium">
              Anything else? <span className="text-ink-subtle font-normal">· optional</span>
            </label>
            <textarea
              id="report-details"
              value={details}
              onChange={(event) => setDetails(event.target.value)}
              maxLength={1000}
              rows={3}
              className="border-line-strong bg-surface text-ink w-full rounded-lg border px-3.5 py-2.5 text-sm"
            />
          </div>
          {(reason === 'intimate_image' || reason === 'child_safety') && (
            <p className="bg-surface-sunken text-ink-muted rounded-lg p-3 text-xs leading-relaxed">
              This goes to the top of our queue. If someone is in immediate danger, contact the
              police on 112.
            </p>
          )}
          {error && (
            <p role="alert" className="text-negative text-sm">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button onClick={submit} loading={pending}>
              Send report
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  )
}
