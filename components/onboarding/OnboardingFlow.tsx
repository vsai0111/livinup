'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { finishOnboardingAction, saveIdentityAction } from '@/app/(onboarding)/onboarding/actions'
import { POST_LIMITS } from '@/config/community'
import { AccountRow } from '@/components/community/AccountRow'
import { FollowButton } from '@/components/community/FollowButton'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { AddPiecesDialog } from '@/components/wardrobe/AddPiecesDialog'
import type { BrandOption } from '@/components/wardrobe/ItemForm'
import { usernameProblem } from '@/lib/profiles/username'
import type { AuthorSummary } from '@/types/community'

type Step = 'identity' | 'pieces' | 'follow'

export function OnboardingFlow({
  step,
  displayName: initialName,
  suggestedUsername,
  needsConsent,
  needsInvite,
  itemCount,
  suggestions,
  brands,
}: {
  step: Step
  displayName: string
  suggestedUsername: string
  needsConsent: boolean
  needsInvite: boolean
  itemCount: number
  suggestions: AuthorSummary[]
  brands: BrandOption[]
}) {
  const router = useRouter()
  const [displayName, setDisplayName] = useState(initialName)
  const [username, setUsername] = useState(suggestedUsername)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const steps: Step[] = ['identity', 'pieces', 'follow']
  const index = steps.indexOf(step)
  const problem = username ? usernameProblem(username) : null

  const saveIdentity = () =>
    startTransition(async () => {
      setError(null)
      const result = await saveIdentityAction({
        displayName,
        username,
        ageConfirmed,
        termsAccepted,
        inviteCode,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/onboarding?step=pieces')
      router.refresh()
    })

  const finish = () =>
    startTransition(async () => {
      const result = await finishOnboardingAction()
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push(itemCount > 0 ? '/wardrobe' : '/home')
      router.refresh()
    })

  return (
    <div>
      <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
        Step {index + 1} of {steps.length}
      </p>
      <div className="mt-2 flex gap-1.5" aria-hidden="true">
        {steps.map((value, position) => (
          <span
            key={value}
            className={`h-1 flex-1 rounded-full ${position <= index ? 'bg-ink' : 'bg-line'}`}
          />
        ))}
      </div>

      {step === 'identity' && (
        <div className="mt-8">
          <h1 className="text-ink text-2xl font-semibold tracking-tight sm:text-3xl">
            Set up your profile
          </h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            Your username is your public address on LivinUp. Your wardrobe stays private whatever
            you choose.
          </p>
          <div className="mt-8 space-y-5">
            <Field
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={POST_LIMITS.displayNameLength}
              autoComplete="name"
            />
            <Field
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              maxLength={30}
              autoComplete="username"
              hint="3–30 letters, numbers, dots or underscores, starting with a letter."
              error={problem ?? undefined}
            />
            {needsInvite && (
              <Field
                label="Invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                autoComplete="off"
                hint="LivinUp is invite-only during the beta."
              />
            )}
            {needsConsent && (
              <div className="space-y-3">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(e) => setAgeConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-ink">I am 18 or older.</span>
                </label>
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--color-primary)]"
                  />
                  <span className="text-ink">
                    I agree to the{' '}
                    <Link href="/terms" target="_blank" className="underline">
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link href="/privacy" target="_blank" className="underline">
                      Privacy Policy
                    </Link>
                    .
                  </span>
                </label>
              </div>
            )}
            {error && (
              <p role="alert" className="text-negative text-sm">
                {error}
              </p>
            )}
            <Button
              size="lg"
              onClick={saveIdentity}
              loading={pending}
              disabled={!displayName.trim() || !username || Boolean(problem)}
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 'pieces' && (
        <div className="mt-8">
          <h1 className="text-ink text-2xl font-semibold tracking-tight sm:text-3xl">
            Add a few things you own
          </h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            Start small: a top, a bottom and a pair of shoes you wear a lot. You can add the rest
            any time.
          </p>
          <div className="border-line mt-8 rounded-2xl border border-dashed p-8 text-center">
            <p className="text-ink text-sm font-medium">
              {itemCount > 0
                ? `${itemCount} ${itemCount === 1 ? 'piece' : 'pieces'} in your wardrobe`
                : 'Your wardrobe is empty'}
            </p>
            <Button className="mt-4" onClick={() => setAdding(true)}>
              {itemCount > 0 ? 'Add more' : 'Add pieces'}
            </Button>
          </div>
          <div className="mt-8 flex items-center gap-3">
            <Button size="lg" onClick={() => router.push('/onboarding?step=follow')}>
              {itemCount > 0 ? 'Continue' : 'Skip for now'}
            </Button>
          </div>
          {adding && (
            <AddPiecesDialog
              mode="photos"
              brands={brands}
              onClose={() => {
                setAdding(false)
                router.refresh()
              }}
            />
          )}
        </div>
      )}

      {step === 'follow' && (
        <div className="mt-8">
          <h1 className="text-ink text-2xl font-semibold tracking-tight sm:text-3xl">
            Follow people and brands
          </h1>
          <p className="text-ink-muted mt-2 text-sm leading-relaxed">
            Their outfits will show up on your home feed.
          </p>
          {suggestions.length === 0 ? (
            <p className="text-ink-muted mt-8 text-sm">
              No suggestions yet. You can find people from Home any time.
            </p>
          ) : (
            <ul className="border-line mt-6 divide-y divide-[var(--color-line)] rounded-2xl border">
              {suggestions.map((account) => (
                <li key={account.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <AccountRow account={account} />
                  </div>
                  <FollowButton profileId={account.id} initialFollowing={false} />
                </li>
              ))}
            </ul>
          )}
          {error && (
            <p role="alert" className="text-negative mt-4 text-sm">
              {error}
            </p>
          )}
          <Button size="lg" className="mt-8" onClick={finish} loading={pending}>
            Finish
          </Button>
        </div>
      )}
    </div>
  )
}
