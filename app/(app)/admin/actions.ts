'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fail, UserFacingError, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { makeBrand, setBrandVerified, updateBrandWebsite } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { createInvite, disableInvite } from '@/lib/moderation/invites'
import { logAction, resolveReport, unsuspend } from '@/lib/moderation/reports'
import { normalizeUsername } from '@/lib/profiles/username'
import type { SessionUser } from '@/types/user'

/**
 * Admin actions. Every one re-checks the admin role on the server; the admin
 * pages being hidden from members is not the control.
 */

function assertAdmin(session: SessionUser): void {
  if (session.profile.role !== 'admin') throw new UserFacingError('Not available.')
}

const uuid = z.string().uuid()
const reason = z.string().trim().min(1).max(1000)

export async function resolveReportAction(
  reportId: string,
  action: 'remove_content' | 'suspend' | 'dismiss',
  note: string,
): Promise<ActionResult> {
  const id = uuid.safeParse(reportId)
  const kind = z.enum(['remove_content', 'suspend', 'dismiss']).safeParse(action)
  const text = reason.safeParse(note)
  if (!id.success || !kind.success) return fail('That report could not be found.')
  if (!text.success) return fail('Give a reason. It goes in the audit log.')

  return runAction('resolveReport', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    await resolveReport(db, session.id, id.data, kind.data, text.data)
    revalidatePath('/admin')
    return undefined
  }) as Promise<ActionResult>
}

export async function unsuspendAction(profileId: string, note: string): Promise<ActionResult> {
  const id = uuid.safeParse(profileId)
  const text = reason.safeParse(note)
  if (!id.success || !text.success) return fail('Give a reason. It goes in the audit log.')
  return runAction('unsuspend', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    await unsuspend(db, session.id, id.data, text.data)
    revalidatePath('/admin')
    return undefined
  }) as Promise<ActionResult>
}

const brandSchema = z.object({
  username: z.string().trim().min(1).max(31),
  websiteUrl: z
    .string()
    .trim()
    .max(300)
    .nullish()
    .transform((v) => (v ? v : null)),
})

export async function makeBrandAction(input: unknown): Promise<ActionResult> {
  const parsed = brandSchema.safeParse(input)
  if (!parsed.success) return fail('Enter the account’s username.')
  return runAction('makeBrand', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    const rows = await db.query<{ id: string }>(
      'select id::text from profiles where lower(username) = $1',
      [normalizeUsername(parsed.data.username)],
    )
    const profileId = rows[0]?.id
    if (!profileId) throw new UserFacingError('No account has that username.')
    await makeBrand(db, profileId, parsed.data.websiteUrl)
    await logAction(db, session.id, 'make_brand', 'profile', profileId, null, 'converted to brand')
    revalidatePath('/admin/brands')
    return undefined
  }) as Promise<ActionResult>
}

export async function setBrandVerifiedAction(
  profileId: string,
  verified: boolean,
): Promise<ActionResult> {
  const id = uuid.safeParse(profileId)
  if (!id.success) return fail('That brand could not be found.')
  return runAction('verifyBrand', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    await setBrandVerified(db, id.data, session.id, verified)
    await logAction(
      db,
      session.id,
      verified ? 'verify_brand' : 'unverify_brand',
      'profile',
      id.data,
      null,
      verified ? 'verified' : 'verification removed',
    )
    revalidatePath('/admin/brands')
    revalidatePath('/brands')
    return undefined
  }) as Promise<ActionResult>
}

export async function updateBrandWebsiteAction(
  profileId: string,
  websiteUrl: string,
): Promise<ActionResult> {
  const id = uuid.safeParse(profileId)
  if (!id.success) return fail('That brand could not be found.')
  return runAction('brandWebsite', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    await updateBrandWebsite(db, id.data, websiteUrl.trim() || null)
    revalidatePath('/admin/brands')
    return undefined
  }) as Promise<ActionResult>
}

export async function createInviteAction(input: unknown): Promise<ActionResult<{ code: string }>> {
  const parsed = z
    .object({
      maxUses: z.coerce.number().int().min(1).max(1000),
      expiresInDays: z.coerce.number().int().min(1).max(365).nullable(),
    })
    .safeParse(input)
  if (!parsed.success) return fail('Uses must be 1–1000 and expiry 1–365 days.')
  return runAction('createInvite', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    const code = await createInvite(db, session.id, parsed.data)
    revalidatePath('/admin/invites')
    return { code }
  })
}

export async function disableInviteAction(code: string): Promise<ActionResult> {
  return runAction('disableInvite', async (session) => {
    assertAdmin(session)
    const db = await getDb()
    await disableInvite(db, session.id, code)
    revalidatePath('/admin/invites')
    return undefined
  }) as Promise<ActionResult>
}
