'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { serverEnv } from '@/config/env.server'
import { POST_LIMITS } from '@/config/community'
import { fail, UserFacingError, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { recordEvent } from '@/lib/analytics/events'
import { getDb } from '@/lib/db'
import { redeemInvite } from '@/lib/moderation/invites'
import {
  completeOnboarding,
  consentState,
  recordConsent,
  updateProfile,
} from '@/lib/profiles/repository'

/**
 * Onboarding step 1: identity. Username and display name are required; the
 * 18+ confirmation and the terms are required too if they were not given at
 * sign-up (Google sign-in skips the sign-up form). During the closed beta an
 * invite code is needed if the account has not redeemed one.
 */

const identitySchema = z.object({
  displayName: z.string().trim().min(1).max(POST_LIMITS.displayNameLength),
  username: z.string().trim().min(1).max(31),
  ageConfirmed: z.boolean().optional(),
  termsAccepted: z.boolean().optional(),
  inviteCode: z.string().trim().max(40).optional(),
})

export async function saveIdentityAction(input: unknown): Promise<ActionResult> {
  const parsed = identitySchema.safeParse(input)
  if (!parsed.success) return fail('Add a display name and a username.')

  return runAction('onboardingIdentity', async (session) => {
    const db = await getDb()
    const state = await consentState(db, session.id)

    if (!state.consented) {
      if (!parsed.data.ageConfirmed)
        throw new UserFacingError('LivinUp is for people aged 18 or over.')
      if (!parsed.data.termsAccepted)
        throw new UserFacingError('Agree to the Terms and Privacy Policy to continue.')
    }
    if (
      serverEnv().LIVINUP_REQUIRE_INVITE &&
      !state.inviteCode &&
      session.profile.role !== 'admin'
    ) {
      await redeemInvite(db, session.id, parsed.data.inviteCode ?? '')
    }

    await updateProfile(db, session.id, {
      displayName: parsed.data.displayName,
      username: parsed.data.username,
      bio: session.profile.bio,
    })
    if (!state.consented) await recordConsent(db, session.id)
    await recordEvent(db, { userId: session.id, eventType: 'onboarding_started' })
    revalidatePath('/', 'layout')
    return undefined
  }) as Promise<ActionResult>
}

export async function finishOnboardingAction(): Promise<ActionResult> {
  return runAction('onboardingFinish', async (session) => {
    if (!session.profile.username) throw new UserFacingError('Choose a username first.')
    const db = await getDb()
    if (!session.profile.onboardingCompleted) {
      await completeOnboarding(db, session.id)
      await recordEvent(db, { userId: session.id, eventType: 'onboarding_completed' })
    }
    revalidatePath('/', 'layout')
    return undefined
  }) as Promise<ActionResult>
}
