'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  createInviteAction,
  disableInviteAction,
  makeBrandAction,
  resolveReportAction,
  setBrandVerifiedAction,
  unsuspendAction,
} from '@/app/(app)/admin/actions'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'

function useRun() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (work: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) =>
    startTransition(async () => {
      setError(null)
      const result = await work()
      if (!result.ok) setError(result.error ?? 'That did not work.')
      else {
        after?.()
        router.refresh()
      }
    })
  return { error, pending, run }
}

export function ResolveReport({ reportId, canRemove }: { reportId: string; canRemove: boolean }) {
  const [reason, setReason] = useState('')
  const { error, pending, run } = useRun()
  return (
    <div className="space-y-2">
      <label className="sr-only" htmlFor={`reason-${reportId}`}>
        Reason for the audit log
      </label>
      <input
        id={`reason-${reportId}`}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (goes in the audit log)"
        maxLength={1000}
        className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle h-9 w-full rounded-lg border px-3 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        {canRemove && (
          <Button
            size="sm"
            variant="danger"
            loading={pending}
            onClick={() => run(() => resolveReportAction(reportId, 'remove_content', reason))}
          >
            Remove content
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => run(() => resolveReportAction(reportId, 'suspend', reason))}
        >
          Suspend account
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(() => resolveReportAction(reportId, 'dismiss', reason))}
        >
          Dismiss
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-negative text-xs">
          {error}
        </p>
      )}
    </div>
  )
}

export function Unsuspend({ profileId }: { profileId: string }) {
  const { error, pending, run } = useRun()
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        size="sm"
        variant="secondary"
        loading={pending}
        onClick={() => run(() => unsuspendAction(profileId, 'Suspension lifted by admin'))}
      >
        Lift suspension
      </Button>
      {error && <span className="text-negative text-xs">{error}</span>}
    </span>
  )
}

export function MakeBrandForm() {
  const [username, setUsername] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const { error, pending, run } = useRun()
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Field
        label="Account username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="brandname"
      />
      <Field
        label="Website"
        value={websiteUrl}
        onChange={(e) => setWebsiteUrl(e.target.value)}
        placeholder="https://"
      />
      <Button
        loading={pending}
        onClick={() =>
          run(
            () => makeBrandAction({ username, websiteUrl }),
            () => {
              setUsername('')
              setWebsiteUrl('')
            },
          )
        }
      >
        Make brand
      </Button>
      {error && (
        <p role="alert" className="text-negative text-sm sm:col-span-3">
          {error}
        </p>
      )}
    </div>
  )
}

export function VerifyBrand({ profileId, verified }: { profileId: string; verified: boolean }) {
  const { error, pending, run } = useRun()
  return (
    <span className="inline-flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant={verified ? 'secondary' : 'primary'}
        loading={pending}
        onClick={() => run(() => setBrandVerifiedAction(profileId, !verified))}
      >
        {verified ? 'Remove verification' : 'Verify'}
      </Button>
      {error && <span className="text-negative text-xs">{error}</span>}
    </span>
  )
}

export function CreateInviteForm() {
  const [maxUses, setMaxUses] = useState('10')
  const [days, setDays] = useState('30')
  const [created, setCreated] = useState<string | null>(null)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const create = () =>
    startTransition(async () => {
      setError(null)
      const result = await createInviteAction({
        maxUses,
        expiresInDays: days ? Number(days) : null,
      })
      if (!result.ok) setError(result.error)
      else {
        setCreated(result.data.code)
        router.refresh()
      }
    })
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field
          label="Uses"
          type="number"
          min={1}
          max={1000}
          value={maxUses}
          onChange={(e) => setMaxUses(e.target.value)}
        />
        <Field
          label="Expires after (days)"
          type="number"
          min={1}
          max={365}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          hint="Empty for no expiry."
        />
        <Button loading={pending} onClick={create}>
          Create code
        </Button>
      </div>
      {created && (
        <p className="bg-accent-soft text-accent-strong rounded-lg px-3 py-2 text-sm">
          New code: <code className="font-mono font-semibold">{created}</code>
        </p>
      )}
      {error && (
        <p role="alert" className="text-negative text-sm">
          {error}
        </p>
      )}
    </div>
  )
}

export function DisableInvite({ code }: { code: string }) {
  const { pending, run } = useRun()
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={pending}
      onClick={() => run(() => disableInviteAction(code))}
    >
      Disable
    </Button>
  )
}
