'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { POST_LIMITS } from '@/config/community'
import { deleteAccount } from '@/lib/account/delete'
import { fail, UserFacingError, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { recordEvent } from '@/lib/analytics/events'
import { getAuthProvider, getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { reportError } from '@/lib/logging/logger'
import { setAvatar, setExploreVisible, updateProfile } from '@/lib/profiles/repository'

const profileSchema = z.object({
  displayName: z.string().trim().min(1).max(POST_LIMITS.displayNameLength),
  username: z.string().trim().min(1).max(31),
  bio: z
    .string()
    .trim()
    .max(POST_LIMITS.bioLength)
    .nullish()
    .transform((v) => (v ? v : null)),
})

export async function updateProfileAction(
  input: unknown,
): Promise<ActionResult<{ username: string }>> {
  const parsed = profileSchema.safeParse(input)
  if (!parsed.success) return fail('Add a display name, a username and a bio under 160 characters.')
  return runAction('updateProfile', async (session) => {
    const db = await getDb()
    await updateProfile(db, session.id, parsed.data)
    const username = parsed.data.username.trim().replace(/^@/, '').toLowerCase()
    revalidatePath('/', 'layout')
    return { username }
  })
}

export async function setAvatarAction(mediaId: string | null): Promise<ActionResult> {
  const parsed = z.string().uuid().nullable().safeParse(mediaId)
  if (!parsed.success) return fail('That photo could not be used.')
  return runAction('setAvatar', async (session) => {
    const db = await getDb()
    await setAvatar(db, session.id, parsed.data)
    revalidatePath('/', 'layout')
    return undefined
  }) as Promise<ActionResult>
}

export async function setExploreVisibleAction(visible: boolean): Promise<ActionResult> {
  return runAction('setExploreVisible', async (session) => {
    const db = await getDb()
    await setExploreVisible(db, session.id, visible)
    revalidatePath('/settings')
    revalidatePath('/home')
    return undefined
  }) as Promise<ActionResult>
}

const passwordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(1).max(200),
})

export async function changePasswordAction(input: unknown): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse(input)
  if (!parsed.success) return fail('Enter your current and new password.')
  return runAction(
    'changePassword',
    async () => {
      const result = await getAuthProvider().changePassword(parsed.data)
      if (!result.ok) throw new UserFacingError(result.message)
      return undefined
    },
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

/**
 * Delete the account. Requires the username typed back as confirmation, and is
 * allowed for suspended accounts too: anyone may leave.
 */
export async function deleteAccountAction(confirmation: string): Promise<ActionResult> {
  const session = await getSessionUser()
  if (!session) return fail('You need to be signed in to do that.')

  const expected = session.profile.username ?? 'delete my account'
  if (confirmation.trim().toLowerCase().replace(/^@/, '') !== expected.toLowerCase()) {
    return fail(`Type ${session.profile.username ? `@${expected}` : `“${expected}”`} to confirm.`)
  }

  try {
    const db = await getDb()
    await deleteAccount(db, session.id)
    await recordEvent(db, { eventType: 'account_deleted' })
    await getAuthProvider()
      .signOut()
      .catch(() => {})
  } catch (error) {
    const reference = reportError(error, { operation: 'deleteAccount', userId: session.id })
    return fail('Your account could not be deleted. Please try again.', reference)
  }
  redirect('/account-deleted')
}
