'use client'

import { useActionState, type ReactNode } from 'react'
import Link from 'next/link'
import type { AuthFormState } from '@/app/(auth)/actions'
import { Button, ButtonLink } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { MIN_PASSWORD_LENGTH } from '@/config/auth'
import { APP_NAME } from '@/config/app'

/**
 * Shared sign-in / sign-up form.
 *
 * Uses `useActionState`, so the form posts and works without client JavaScript;
 * the pending state and inline errors are a progressive enhancement rather than
 * a requirement.
 */
export function AuthForm({
  mode,
  action,
  googleAction,
  next,
  notice,
  inviteRequired = false,
  defaultInvite,
}: {
  mode: 'signin' | 'signup'
  action: (state: AuthFormState, formData: FormData) => Promise<AuthFormState>
  /** Present only when Google sign-in is enabled. */
  googleAction?: (formData: FormData) => Promise<void>
  next?: string
  /**
   * Why the visitor was sent here (an expired confirmation link, typically).
   * Cleared as soon as the form reports something of its own, so a stale
   * explanation cannot sit above a fresh error.
   */
  notice?: string
  inviteRequired?: boolean
  defaultInvite?: string
}) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(action, {})
  const isSignUp = mode === 'signup'

  // The account exists but is not usable yet. Re-rendering the form here would
  // invite the user to try signing in, which is exactly the dead end this
  // screen replaces.
  if (state.verificationEmail) {
    return (
      <div role="status" aria-live="polite">
        <h1 className="text-ink text-xl font-semibold sm:text-2xl">Check your email</h1>
        <p className="text-ink-muted mt-2 text-sm leading-relaxed">
          Your account is created. We sent a verification link to{' '}
          <span className="text-ink font-medium break-words">{state.verificationEmail}</span>.
        </p>

        <div className="border-line bg-surface-sunken mt-6 rounded-[var(--radius-card)] border p-4">
          <p className="text-ink text-sm font-medium">Verify your email before signing in</p>
          <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
            Sign-in will not work until you open that link. If it has not arrived within a couple of
            minutes, check your spam folder.
          </p>
        </div>

        <ButtonLink href="/signin" size="lg" className="mt-6 w-full">
          I have verified, sign in
        </ButtonLink>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-ink text-xl font-semibold sm:text-2xl">
        {isSignUp ? 'Create your account' : 'Welcome back'}
      </h1>
      <p className="text-ink-muted mt-2 text-sm leading-relaxed">
        {isSignUp
          ? 'Start your wardrobe in under a minute. Everything you add is private until you share it.'
          : 'Sign in to your wardrobe.'}
      </p>

      {notice && !state.error && (
        <p
          role="alert"
          className="border-negative/25 bg-negative/5 text-negative mt-5 rounded-[var(--radius-control)] border px-3.5 py-3 text-sm leading-relaxed"
        >
          {notice}
        </p>
      )}

      {googleAction && (
        <>
          <form action={googleAction} className="mt-6">
            {next && <input type="hidden" name="next" value={next} />}
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              <GoogleMark />
              Continue with Google
            </Button>
          </form>
          {isSignUp && (
            <p className="text-ink-subtle mt-2 text-xs leading-relaxed">
              By continuing with Google you confirm you are 18 or over and agree to the{' '}
              <Link href="/terms" className="underline underline-offset-2">
                Terms
              </Link>{' '}
              and{' '}
              <Link href="/privacy" className="underline underline-offset-2">
                Privacy Policy
              </Link>
              .
            </p>
          )}
          <div className="text-ink-subtle my-5 flex items-center gap-3 text-xs">
            <span className="bg-line h-px flex-1" />
            or with email
            <span className="bg-line h-px flex-1" />
          </div>
        </>
      )}

      <form
        action={formAction}
        className={googleAction ? 'space-y-4' : 'mt-6 space-y-4'}
        noValidate
      >
        {next && <input type="hidden" name="next" value={next} />}

        <Field
          label="Email address"
          name="email"
          type="email"
          autoComplete="email"
          required
          error={state.field === 'email' ? state.error : undefined}
        />

        <div>
          <Field
            label="Password"
            name="password"
            type="password"
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
            required
            minLength={isSignUp ? MIN_PASSWORD_LENGTH : undefined}
            hint={isSignUp ? `At least ${MIN_PASSWORD_LENGTH} characters.` : undefined}
            error={state.field === 'password' ? state.error : undefined}
          />
          {!isSignUp && (
            <p className="mt-2 text-right text-xs">
              <Link
                href="/reset-password"
                className="text-ink-muted hover:text-ink underline underline-offset-2"
              >
                Forgot password?
              </Link>
            </p>
          )}
        </div>

        {isSignUp && inviteRequired && (
          <Field
            label="Invite code"
            name="inviteCode"
            autoComplete="off"
            autoCapitalize="characters"
            defaultValue={defaultInvite}
            required
            hint="LivinUp is invite-only during the beta."
            error={state.field === 'invite' ? state.error : undefined}
          />
        )}

        {isSignUp && (
          <fieldset className="space-y-2.5 pt-1">
            <legend className="sr-only">Confirmations</legend>
            <Checkbox name="ageConfirmed">I am 18 or older.</Checkbox>
            <Checkbox name="termsAccepted">
              I agree to the{' '}
              <Link href="/terms" target="_blank" className="text-ink underline underline-offset-2">
                Terms
              </Link>
              ,{' '}
              <Link
                href="/privacy"
                target="_blank"
                className="text-ink underline underline-offset-2"
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                href="/guidelines"
                target="_blank"
                className="text-ink underline underline-offset-2"
              >
                Community Guidelines
              </Link>
              .
            </Checkbox>
            {state.field === 'consent' && (
              <p role="alert" className="text-negative text-xs">
                {state.error}
              </p>
            )}
          </fieldset>
        )}

        {state.error && !state.field && (
          <p
            role="alert"
            className="border-negative/25 bg-negative/5 text-negative rounded-[var(--radius-control)] border px-3.5 py-3 text-sm leading-relaxed"
          >
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" loading={pending} className="mt-1 w-full">
          {isSignUp ? 'Create account' : 'Sign in'}
        </Button>
      </form>

      <p className="text-ink-muted border-line mt-6 border-t pt-5 text-sm">
        {isSignUp ? 'Already have an account? ' : `New to ${APP_NAME}? `}
        <Link
          href={isSignUp ? '/signin' : '/signup'}
          className="text-ink font-medium underline underline-offset-2"
        >
          {isSignUp ? 'Sign in' : 'Create an account'}
        </Link>
      </p>
    </div>
  )
}

function Checkbox({ name, children }: { name: string; children: ReactNode }) {
  return (
    <label className="text-ink-muted flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
      <input
        type="checkbox"
        name={name}
        required
        className="border-line-strong accent-ink mt-0.5 size-4 shrink-0 rounded"
      />
      <span>{children}</span>
    </label>
  )
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1z" />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z"
      />
    </svg>
  )
}
