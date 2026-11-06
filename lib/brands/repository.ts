import 'server-only'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { AUTHOR_COLUMNS, authorFromRow, type AuthorRow } from '@/lib/profiles/repository'
import { isSafeHttpUrl } from '@/lib/utils/url'
import type { AuthorSummary } from '@/types/community'

/**
 * Brand presence (v1): verified brand profiles, brand posts, a directory and
 * brand tags. No product listings, catalogue or shopping (docs/product-spec.md
 * D9).
 *
 * Brands are made by admins: a brand signs up as a normal member, and an admin
 * converts and verifies the account. This keeps impersonation out of reach.
 */

export interface BrandListing extends AuthorSummary {
  bio: string | null
  websiteUrl: string | null
  postCount: number
}

export async function listVerifiedBrands(
  db: Db,
  options: { query?: string; limit?: number } = {},
): Promise<BrandListing[]> {
  const term = options.query?.trim().toLowerCase() ?? ''
  const like = term ? `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null
  const rows = await db.query<
    AuthorRow & { bio: string | null; website_url: string | null; post_count: number }
  >(
    `select ${AUTHOR_COLUMNS}, p.bio, bd.website_url,
            (select count(*) from posts po where po.author_id = p.id and po.status = 'published')::int as post_count
       from profiles p join brand_details bd on bd.profile_id = p.id
      where p.account_type = 'brand' and p.status = 'active' and p.username is not null
        and bd.verified_at is not null
        and ($1::text is null or lower(p.display_name) like $1 or lower(p.username) like $1)
      order by p.display_name
      limit $2`,
    [like, options.limit ?? 200],
  )
  return rows.map((row) => ({
    ...authorFromRow(row),
    bio: row.bio,
    websiteUrl: row.website_url,
    postCount: row.post_count,
  }))
}

/** Convert a member account into a brand account (unverified). Admin only. */
export async function makeBrand(
  db: Db,
  profileId: string,
  websiteUrl: string | null,
): Promise<void> {
  if (websiteUrl && !isSafeHttpUrl(websiteUrl)) {
    throw new UserFacingError('The website must start with http:// or https://')
  }
  await db.transaction(async (tx) => {
    const rows = await tx.query<{ id: string }>(
      `update profiles set account_type = 'brand' where id = $1 and status <> 'deleting' returning id`,
      [profileId],
    )
    if (rows.length === 0) throw new UserFacingError('That account could not be found.')
    await tx.query(
      `insert into brand_details (profile_id, website_url) values ($1, $2)
       on conflict (profile_id) do update set website_url = excluded.website_url`,
      [profileId, websiteUrl],
    )
  })
}

export async function setBrandVerified(
  db: Db,
  profileId: string,
  adminId: string,
  verified: boolean,
): Promise<void> {
  const rows = await db.query<{ profile_id: string }>(
    `update brand_details
        set verified_at = case when $3 then now() else null end,
            verified_by = case when $3 then $2::uuid else null end
      where profile_id = $1
      returning profile_id`,
    [profileId, adminId, verified],
  )
  if (rows.length === 0) throw new UserFacingError('Make the account a brand first.')
}

export async function updateBrandWebsite(db: Db, profileId: string, websiteUrl: string | null) {
  if (websiteUrl && !isSafeHttpUrl(websiteUrl)) {
    throw new UserFacingError('The website must start with http:// or https://')
  }
  await db.query('update brand_details set website_url = $2 where profile_id = $1', [
    profileId,
    websiteUrl,
  ])
}

/** All brand accounts, verified or not, for the admin screen. */
export async function listAllBrands(db: Db) {
  const rows = await db.query<
    AuthorRow & { website_url: string | null; verified_at: unknown; status: string }
  >(
    `select ${AUTHOR_COLUMNS}, bd.website_url, bd.verified_at, p.status
       from profiles p join brand_details bd on bd.profile_id = p.id
      where p.account_type = 'brand'
      order by p.display_name`,
  )
  return rows.map((row) => ({
    ...authorFromRow(row),
    websiteUrl: row.website_url,
    verified: Boolean(row.verified_at),
    status: row.status,
  }))
}
