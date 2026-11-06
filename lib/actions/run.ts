import 'server-only'
import { getSessionUser } from '@/lib/auth'
import { reportError } from '@/lib/logging/logger'
import type { SessionUser } from '@/types/user'
import { fail, UserFacingError, type ActionResult } from './result'

/**
 * Shared wrapper for authenticated Server Actions.
 *
 * - The user always comes from the verified session, never from an argument.
 * - Suspended and deleting accounts cannot mutate anything, except where an
 *   action opts in (account deletion must still work for a suspended account).
 * - `UserFacingError` becomes a plain refusal; anything else is reported and
 *   replaced with a generic message and a reference id.
 *
 * Server Actions are reachable by direct POST, so every action must go through
 * this (or perform the same checks itself).
 */
export async function runAction<T>(
  operation: string,
  fn: (session: SessionUser) => Promise<T>,
  options: { allowSuspended?: boolean } = {},
): Promise<ActionResult<T>> {
  const session = await getSessionUser()
  if (!session) return fail('You need to be signed in to do that.')

  if (session.profile.status === 'deleting') {
    return fail('This account is being deleted.')
  }
  if (session.profile.status === 'suspended' && !options.allowSuspended) {
    return fail('Your account is suspended, so this action is not available.')
  }

  try {
    const data = await fn(session)
    return { ok: true, data } as ActionResult<T>
  } catch (error) {
    if (error instanceof UserFacingError) return fail(error.message)
    const reference = reportError(error, { operation, userId: session.id })
    return fail('Something went wrong. Please try again.', reference)
  }
}
