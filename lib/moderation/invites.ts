import 'server-only'
import { randomBytes } from 'node:crypto'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { isoDate, num, str, strOrNull } from '@/lib/db/rows'
import { logAction } from './reports'

/** Invite codes for the closed beta (docs/product-spec.md P9). */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  const bytes = randomBytes(8)
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('')
  return `LIVIN-${chars.slice(0, 4)}-${chars.slice(4, 8)}`
}

export function normalizeInviteCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export async function createInvite(
  db: Db,
  adminId: string,
  input: { maxUses: number; expiresInDays: number | null },
): Promise<string> {
  const maxUses = Math.min(Math.max(Math.trunc(input.maxUses), 1), 1000)
  const code = generateCode()
  await db.query(
    `insert into invite_codes (code, max_uses, expires_at, created_by)
     values ($1, $2, case when $3::int is null then null else now() + ($3::int * interval '1 day') end, $4)`,
    [code, maxUses, input.expiresInDays, adminId],
  )
  await logAction(db, adminId, 'create_invite', 'invite', code, null, `max ${maxUses} uses`)
  return code
}

export async function disableInvite(db: Db, adminId: string, code: string) {
  await db.query('update invite_codes set disabled_at = now() where code = $1', [code])
  await logAction(db, adminId, 'disable_invite', 'invite', code, null, 'disabled')
}

export async function listInvites(db: Db) {
  const rows = await db.query<Record<string, unknown>>(
    `select code, max_uses, uses, expires_at, disabled_at, created_at,
            (expires_at is not null and expires_at <= now()) as expired
       from invite_codes
      order by created_at desc limit 200`,
  )
  return rows.map((row) => ({
    code: str(row.code),
    maxUses: num(row.max_uses),
    uses: num(row.uses),
    expiresAt: row.expires_at ? isoDate(row.expires_at) : null,
    disabled: Boolean(row.disabled_at),
    expired: Boolean(row.expired),
    createdAt: isoDate(row.created_at),
  }))
}

/**
 * Use one seat of an invite for this profile. Atomic: two people cannot both
 * take the last seat.
 */
export async function redeemInvite(db: Db, profileId: string, rawCode: string): Promise<void> {
  const code = normalizeInviteCode(rawCode)
  if (!code) throw new UserFacingError('Enter your invite code.')
  await db.transaction(async (tx) => {
    const rows = await tx.query<{ code: string }>(
      `update invite_codes set uses = uses + 1
        where code = $1 and disabled_at is null and uses < max_uses
          and (expires_at is null or expires_at > now())
        returning code`,
      [code],
    )
    if (rows.length === 0)
      throw new UserFacingError('That invite code is not valid or has been used up.')
    await tx.query('update profiles set invite_code = $2 where id = $1', [profileId, code])
  })
}

export async function profileInvite(db: Db, profileId: string): Promise<string | null> {
  const rows = await db.query<{ invite_code: string | null }>(
    'select invite_code from profiles where id = $1',
    [profileId],
  )
  return strOrNull(rows[0]?.invite_code)
}
