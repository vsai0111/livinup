'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import type { AuthFormState } from '@/app/(auth)/actions'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { MIN_PASSWORD_LENGTH } from '@/config/auth'

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

/** Step 1: ask for the email address. The reply never reveals whether it has an account. */
export function RequestResetForm({ action }: { action: Action }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {})

  if (state.resetRequested) {
    return (
      <div role="status" aria-live="polite">
        <h1 className="text-ink text-xl font-semibold sm:text-2xl">Check your email</h1>
        <p className="text-ink-muted mt-2 text-sm leading-relaxed">
          If that address has a LivinUp account, a link to choose a new password is on its way. It
          expires after an hour.
        </p>
        <p className="text-ink-muted border-line mt-6 border-t pt-5 text-sm">
          <Link href="/signin" className="text-ink font-medium underline underline-offset-2">
            Back to sign in
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-ink text-xl font-semibold sm:text-2xl">Reset your password</h1>
      <p className="text-ink-muted mt-2 text-sm leading-relaxed">
        Enter the email you signed up with and we will send you a link.
      </p>
      <form action={formAction} className="mt-6 space-y-4" noValidate>
        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.field === 'email' ? state.error : undefined}
        />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Send reset link
        </Button>
      </form>
      <p className="text-ink-muted border-line mt-6 border-t pt-5 text-sm">
        Remembered it?{' '}
        <Link href="/signin" className="text-ink font-medium underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </div>
  )
}

/** Step 2: choose the new password. `token` is only used by the local auth provider. */
export function NewPasswordForm({ action, token }: { action: Action; token?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {})

  return (
    <div>
      <h1 className="text-ink text-xl font-semibold sm:text-2xl">Choose a new password</h1>
      <p className="text-ink-muted mt-2 text-sm leading-relaxed">
        You will be signed in once it is saved.
      </p>
      <form action={formAction} className="mt-6 space-y-4" noValidate>
        {token && <input type="hidden" name="token" value={token} />}
        <Field
          label="New password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
          error={state.field === 'password' ? state.error : undefined}
        />
        <Field
          label="Confirm new password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
        />
        {state.error && !state.field && (
          <p
            role="alert"
            className="border-negative/25 bg-negative/5 text-negative rounded-[var(--radius-control)] border px-3.5 py-3 text-sm leading-relaxed"
          >
            {state.error}
          </p>
        )}
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Save password
        </Button>
      </form>
    </div>
  )
}
