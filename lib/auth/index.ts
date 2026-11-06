import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { supabaseAuthConfigured } from '@/config/env.server'
import { getDb } from '@/lib/db'
import type { Db } from '@/lib/db/types'
import { profileFromRow, PROFILE_COLUMNS, type ProfileRow } from '@/lib/profiles/rows'
import type { AuthUser, Profile, SessionUser } from '@/types/user'
import { LocalAuthProvider } from './local-provider'
import { SupabaseAuthProvider } from './supabase-provider'
import type { AuthProvider } from './types'

export type { AuthProvider, AuthResult, AuthErrorCode } from './types'

/**
 * Choose the auth provider once, from configuration.
 *
 * Supabase Auth whenever it is configured; the local provider otherwise, so a
 * fresh clone can run the whole product with no credentials.
 */
export function getAuthProvider(): AuthProvider {
  return supabaseAuthConfigured() ? new SupabaseAuthProvider() : new LocalAuthProvider()
}

/**
 * The authenticated user for this request, or null.
 *
 * Wrapped in React's `cache` so a page rendering several Server Components
 * verifies the session once per request rather than once per component.
 */
export const getCurrentUser = cache(async () => {
  return getAuthProvider().getUser()
})

/**
 * The user together with their profile, creating the profile on first sight.
 *
 * An account being deleted is treated as signed out everywhere: it must not be
 * usable while its data is being removed.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const user = await getCurrentUser()
  if (!user) return null

  const db = await getDb()
  const profile = await ensureProfile(db, user)
  if (profile.status === 'deleting') return null
  return { ...user, profile }
})

/**
 * Create this user's profile row if it does not exist, and return it.
 *
 * Idempotent, and the single place a profile comes into being. Lazy rather than
 * a database trigger, so it works identically under both auth providers.
 */
export async function ensureProfile(db: Db, user: AuthUser): Promise<Profile> {
  const rows = await db.query<ProfileRow>(
    `insert into profiles (id, display_name)
     values ($1, $2)
     on conflict (id) do update set id = profiles.id
     returning ${PROFILE_COLUMNS}`,
    [user.id, defaultDisplayName(user.email)],
  )
  return profileFromRow(rows[0])
}

/**
 * Require an authenticated user, redirecting to sign-in when there is none.
 *
 * Every signed-in page calls this. It is the authorisation boundary; the proxy
 * only redirects for a better experience and is not relied on for access
 * control.
 */
export async function requireUser(returnTo?: string): Promise<SessionUser> {
  const session = await getSessionUser()
  if (!session) {
    const target = returnTo ? `/signin?next=${encodeURIComponent(returnTo)}` : '/signin'
    redirect(target)
  }
  return session
}

/**
 * Require a user who has finished onboarding (and so has a username).
 * Sends everyone else to onboarding first.
 */
export async function requireOnboardedUser(returnTo?: string): Promise<SessionUser> {
  const session = await requireUser(returnTo)
  if (!session.profile.username) redirect('/onboarding')
  return session
}

/** Require an admin. Everyone else gets a plain 404, not a hint that admin exists. */
export async function requireAdmin(): Promise<SessionUser> {
  const session = await requireOnboardedUser('/admin')
  if (session.profile.role !== 'admin') {
    const { notFound } = await import('next/navigation')
    notFound()
  }
  return session
}

/** A friendly initial display name derived from the email local part. */
function defaultDisplayName(email: string): string {
  const local = email.split('@')[0] ?? 'there'
  const cleaned = local.replace(/[._\-+0-9]+/g, ' ').trim()
  if (!cleaned) return 'New member'
  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .slice(0, 80)
}
