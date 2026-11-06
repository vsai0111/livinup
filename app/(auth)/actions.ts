'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { serverEnv } from '@/config/env.server'
import { ensureProfile, getAuthProvider } from '@/lib/auth'
import { getDb } from '@/lib/db'
import type { Db } from '@/lib/db/types'
import type { AuthUser } from '@/types/user'
import { recordEvent } from '@/lib/analytics/events'
import { ensureSessionId } from '@/lib/analytics/session'
import { logger, reportError } from '@/lib/logging/logger'
import { normalizeInviteCode, redeemInvite } from '@/lib/moderation/invites'
import { recordConsent } from '@/lib/profiles/repository'
import { safeInternalPath } from '@/lib/utils/url'
import { resolveSiteOrigin } from '@/lib/auth/site-url'

/**
 * Sign-up, sign-in, password reset and Google sign-in.
 *
 * The forms are `useActionState` form actions, so they work with JavaScript
 * disabled. `next` always goes through `safeInternalPath`, so sign-in cannot be
 * turned into an open redirect.
 */

export interface AuthFormState {
  error?: string
  field?: 'email' | 'password' | 'consent' | 'invite'
  /** Account created; email verification is required before a session exists. */
  verificationEmail?: string
  /** Password reset requested; shown the same whether or not the address exists. */
  resetRequested?: boolean
}

const credentials = z.object({
  email: z.string().trim().min(3).max(320),
  password: z.string().min(1).max(200),
})

function readCredentials(formData: FormData) {
  return credentials.safeParse({
    email: String(formData.get('email') ?? ''),
    password: String(formData.get('password') ?? ''),
  })
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData)
  if (!parsed.success) {
    return { error: 'Enter an email address and a password.', field: 'email' }
  }
  if (formData.get('ageConfirmed') !== 'on') {
    return { error: 'LivinUp is for people aged 18 or over.', field: 'consent' }
  }
  if (formData.get('termsAccepted') !== 'on') {
    return { error: 'Agree to the Terms and Privacy Policy to continue.', field: 'consent' }
  }

  const inviteRequired = serverEnv().LIVINUP_REQUIRE_INVITE
  const inviteCode = normalizeInviteCode(String(formData.get('inviteCode') ?? ''))
  if (inviteRequired && !inviteCode) {
    return {
      error: 'LivinUp is invite-only during the beta. Enter your invite code.',
      field: 'invite',
    }
  }

  const next = safeInternalPath(formData.get('next'), '/onboarding')

  try {
    const db = await getDb()
    if (inviteRequired && !(await inviteIsUsable(db, inviteCode))) {
      return { error: 'That invite code is not valid or has been used up.', field: 'invite' }
    }

    const sessionId = await ensureSessionId()
    await recordEvent(db, { eventType: 'signup_started', sessionId })

    const origin = await resolveSiteOrigin()
    const emailRedirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`

    const result = await getAuthProvider().signUp({ ...parsed.data, emailRedirectTo })
    if (!result.ok) {
      return {
        error: result.message,
        field: result.code === 'weak_password' ? 'password' : 'email',
      }
    }

    if (await provisionProfile(db, result.user, 'signUp')) {
      await recordConsent(db, result.user.id)
      if (inviteRequired) {
        // Taken now so the seat is held; if it fails here (a race for the last
        // seat), onboarding asks again.
        await redeemInvite(db, result.user.id, inviteCode).catch(() => {})
      }
      await recordEvent(db, { userId: result.user.id, sessionId, eventType: 'signup_completed' })
    }

    if (result.confirmationRequired) return { verificationEmail: result.user.email }
    redirect(next)
  } catch (error) {
    if (isRedirectError(error)) throw error
    const reference = reportError(error, { operation: 'signUp' })
    return { error: `Could not create your account. Please try again. (ref ${reference})` }
  }
}

async function inviteIsUsable(db: Db, code: string): Promise<boolean> {
  const rows = await db.query<{ ok: boolean }>(
    `select exists (
       select 1 from invite_codes where code = $1 and disabled_at is null and uses < max_uses
          and (expires_at is null or expires_at > now())
     ) as ok`,
    [code],
  )
  return Boolean(rows[0]?.ok)
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = readCredentials(formData)
  if (!parsed.success) {
    return { error: 'Enter your email address and password.', field: 'email' }
  }

  const next = safeInternalPath(formData.get('next'), '/home')

  try {
    const result = await getAuthProvider().signIn(parsed.data)
    if (!result.ok) {
      // The same message whether the email is unknown or the password wrong.
      return {
        error: result.message,
        field: result.code === 'email_not_confirmed' ? undefined : 'password',
      }
    }

    const db = await getDb()
    if (await provisionProfile(db, result.user, 'signIn')) {
      await recordEvent(db, {
        userId: result.user.id,
        sessionId: await ensureSessionId(),
        eventType: 'signin_completed',
      })
    }
    redirect(next)
  } catch (error) {
    if (isRedirectError(error)) throw error
    const reference = reportError(error, { operation: 'signIn' })
    return { error: `Could not sign you in. Please try again. (ref ${reference})` }
  }
}

export async function signOutAction(): Promise<void> {
  await getAuthProvider().signOut()
  redirect('/')
}

export async function requestPasswordResetAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const email = z
    .string()
    .trim()
    .email()
    .max(320)
    .safeParse(String(formData.get('email') ?? ''))
  if (!email.success)
    return { error: 'Enter the email address you signed up with.', field: 'email' }

  try {
    const origin = await resolveSiteOrigin()
    // Supabase: the link goes through the callback, which establishes a
    // recovery session, then on to the new-password page. Local: the link
    // carries a signed token straight to the page.
    const redirectTo =
      getAuthProvider().id === 'supabase'
        ? `${origin}/auth/callback?next=${encodeURIComponent('/reset-password/new')}`
        : `${origin}/reset-password/new`
    await getAuthProvider().requestPasswordReset({ email: email.data, redirectTo })
  } catch (error) {
    reportError(error, { operation: 'requestPasswordReset' })
  }
  // Identical response either way: this form must not reveal which addresses have accounts.
  return { resetRequested: true }
}

export async function resetPasswordAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  const token = String(formData.get('token') ?? '') || undefined
  if (password.length === 0) return { error: 'Choose a new password.', field: 'password' }
  if (password !== confirm) return { error: 'The two passwords do not match.', field: 'password' }

  try {
    const result = await getAuthProvider().resetPassword({ password, token })
    if (!result.ok) return { error: result.message, field: 'password' }
    const db = await getDb()
    await provisionProfile(db, result.user, 'resetPassword')
  } catch (error) {
    const reference = reportError(error, { operation: 'resetPassword' })
    return { error: `Could not change your password. Please try again. (ref ${reference})` }
  }
  redirect('/home')
}

/** Google sign-in: send the browser to Google via Supabase. */
export async function googleSignInAction(formData: FormData): Promise<void> {
  const next = safeInternalPath(formData.get('next'), '/home')
  const origin = await resolveSiteOrigin()
  const url = await getAuthProvider().googleSignInUrl(
    `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
  )
  redirect(url ?? `/signin?error=google_unavailable&next=${encodeURIComponent(next)}`)
}

async function provisionProfile(db: Db, user: AuthUser, operation: string): Promise<boolean> {
  try {
    await ensureProfile(db, user)
    return true
  } catch (error) {
    logger.warn('could not provision profile; funnel event skipped', { operation, error })
    return false
  }
}

/** Next.js signals navigation by throwing; those must propagate, not be logged. */
function isRedirectError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'digest' in error &&
    typeof (error as { digest?: unknown }).digest === 'string' &&
    (error as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  )
}
