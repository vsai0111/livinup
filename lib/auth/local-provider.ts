import 'server-only'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getDb } from '@/lib/db'
import { logger } from '@/lib/logging/logger'
import type { AuthProvider, AuthResult } from './types'
import { checkPasswordPolicy, hashPassword, verifyPassword } from './password'
import { clearSessionCookie, readSessionUserId, sessionSecret, setSessionCookie } from './session'

/**
 * Local email/password authentication.
 *
 * Used when Supabase Auth is not configured, so LivinUp is fully usable in
 * development and CI without external credentials. Credentials live in
 * `local_auth_users`, which no client-facing database role can read.
 *
 * There is no mail server in local mode, so a password reset link is written
 * to the server log instead of being emailed. This provider is for development
 * and tests; production uses Supabase Auth.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const RESET_TTL_SECONDS = 60 * 60
const DUMMY_HASH =
  'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** A fingerprint of the current password hash: a used token stops matching once the password changes. */
function hashFingerprint(passwordHash: string): string {
  return createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16)
}

function signReset(body: string): string {
  return createHmac('sha256', `reset:${sessionSecret()}`).update(body).digest('base64url')
}

export function createResetToken(userId: string, passwordHash: string, now = Date.now()): string {
  const body = Buffer.from(
    JSON.stringify({
      sub: userId,
      fp: hashFingerprint(passwordHash),
      exp: Math.floor(now / 1000) + RESET_TTL_SECONDS,
    }),
  ).toString('base64url')
  return `${body}.${signReset(body)}`
}

function readResetToken(token: string): { sub: string; fp: string } | null {
  const separator = token.lastIndexOf('.')
  if (separator <= 0) return null
  const body = token.slice(0, separator)
  const expected = Buffer.from(signReset(body))
  const provided = Buffer.from(token.slice(separator + 1))
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as {
      sub?: unknown
      fp?: unknown
      exp?: unknown
    }
    if (typeof payload.sub !== 'string' || typeof payload.fp !== 'string') return null
    if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null
    return { sub: payload.sub, fp: payload.fp }
  } catch {
    return null
  }
}

function weak(message?: string): AuthResult {
  return { ok: false, code: 'weak_password', message: message ?? 'Choose a stronger password.' }
}

export class LocalAuthProvider implements AuthProvider {
  readonly id = 'local' as const

  async signUp({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const normalized = normalizeEmail(email)

    if (!EMAIL_PATTERN.test(normalized)) {
      return { ok: false, code: 'invalid_email', message: 'Enter a valid email address.' }
    }

    const policy = checkPasswordPolicy(password)
    if (!policy.ok) return weak(policy.message)

    const db = await getDb()
    const existing = await db.query<{ id: string }>(
      'select id from local_auth_users where lower(email) = $1',
      [normalized],
    )
    if (existing.length > 0) {
      return {
        ok: false,
        code: 'email_taken',
        message: 'An account already exists for that email address.',
      }
    }

    const passwordHash = await hashPassword(password)

    const rows = await db.query<{ id: string }>(
      'insert into local_auth_users (email, password_hash) values ($1, $2) returning id',
      [normalized, passwordHash],
    )
    const user = { id: rows[0].id, email: normalized }

    await setSessionCookie(user.id)
    logger.info('local signup', { userId: user.id })
    return { ok: true, user }
  }

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const normalized = normalizeEmail(email)
    const db = await getDb()

    const rows = await db.query<{ id: string; email: string; password_hash: string }>(
      'select id, email, password_hash from local_auth_users where lower(email) = $1',
      [normalized],
    )
    const record = rows[0]

    // Always run a verification, even with no matching user, so that response
    // timing does not reveal whether an email address is registered.
    const valid = await verifyPassword(password, record?.password_hash ?? DUMMY_HASH)

    if (!record || !valid) {
      return {
        ok: false,
        code: 'invalid_credentials',
        message: 'That email and password combination is not correct.',
      }
    }

    await setSessionCookie(record.id)
    logger.info('local signin', { userId: record.id })
    return { ok: true, user: { id: record.id, email: record.email } }
  }

  async signOut(): Promise<void> {
    await clearSessionCookie()
  }

  async getUser() {
    const userId = await readSessionUserId()
    if (!userId) return null

    const db = await getDb()
    const rows = await db.query<{ id: string; email: string }>(
      'select id, email from local_auth_users where id = $1',
      [userId],
    )

    // A valid signature for a user that no longer exists is not a session.
    return rows[0] ? { id: rows[0].id, email: rows[0].email } : null
  }

  async requestPasswordReset({ email, redirectTo }: { email: string; redirectTo: string }) {
    const db = await getDb()
    const rows = await db.query<{ id: string; password_hash: string }>(
      'select id, password_hash from local_auth_users where lower(email) = $1',
      [normalizeEmail(email)],
    )
    const record = rows[0]
    if (!record) return

    const url = new URL(redirectTo)
    url.searchParams.set('token', createResetToken(record.id, record.password_hash))
    // Development and tests only: there is no mail server in local mode.
    logger.warn('local password reset link (local auth has no email; use this link)', {
      userId: record.id,
      link: url.toString(),
    })
  }

  async resetPassword({ password, token }: { password: string; token?: string }) {
    const payload = token ? readResetToken(token) : null
    if (!payload) {
      return {
        ok: false as const,
        code: 'not_authenticated' as const,
        message: 'That reset link is not valid or has expired. Request a new one.',
      }
    }

    const policy = checkPasswordPolicy(password)
    if (!policy.ok) return weak(policy.message)

    const db = await getDb()
    const rows = await db.query<{ id: string; email: string; password_hash: string }>(
      'select id, email, password_hash from local_auth_users where id = $1',
      [payload.sub],
    )
    const record = rows[0]
    if (!record || hashFingerprint(record.password_hash) !== payload.fp) {
      return {
        ok: false as const,
        code: 'not_authenticated' as const,
        message: 'That reset link has already been used or has expired. Request a new one.',
      }
    }

    await db.query('update local_auth_users set password_hash = $2 where id = $1', [
      record.id,
      await hashPassword(password),
    ])
    await setSessionCookie(record.id)
    return { ok: true as const, user: { id: record.id, email: record.email } }
  }

  async changePassword({ current, next }: { current: string; next: string }) {
    const userId = await readSessionUserId()
    if (!userId) {
      return { ok: false as const, code: 'not_authenticated' as const, message: 'Sign in again.' }
    }
    const db = await getDb()
    const rows = await db.query<{ id: string; email: string; password_hash: string }>(
      'select id, email, password_hash from local_auth_users where id = $1',
      [userId],
    )
    const record = rows[0]
    if (!record || !(await verifyPassword(current, record.password_hash))) {
      return {
        ok: false as const,
        code: 'invalid_credentials' as const,
        message: 'Your current password is not correct.',
      }
    }
    const policy = checkPasswordPolicy(next)
    if (!policy.ok) return weak(policy.message)

    await db.query('update local_auth_users set password_hash = $2 where id = $1', [
      record.id,
      await hashPassword(next),
    ])
    return { ok: true as const, user: { id: record.id, email: record.email } }
  }

  async googleSignInUrl(): Promise<string | null> {
    return null
  }
}
