import 'server-only'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { bool, isoDate, num, str, strOrNull } from '@/lib/db/rows'
import { deleteMedia } from '@/lib/media/repository'
import { notBlockedSql } from '@/lib/community/blocks'
import type { AuthorSummary, PublicProfile, Relationship } from '@/types/community'
import type { AccountType } from '@/types/user'
import { normalizeUsername, usernameProblem } from './username'

/**
 * Profiles: usernames, public profile pages and profile edits.
 *
 * A profile is publicly visible only when it has a username and its account is
 * active. Suspended, deleting and blocked accounts all read as "not available".
 */

export const AUTHOR_COLUMNS = `
  p.id, p.username, p.display_name, p.avatar_media_id, p.account_type,
  (p.account_type = 'brand' and exists (
     select 1 from brand_details bd where bd.profile_id = p.id and bd.verified_at is not null
  )) as verified`

export interface AuthorRow {
  id: unknown
  username: unknown
  display_name: unknown
  avatar_media_id: unknown
  account_type: unknown
  verified: unknown
}

export function authorFromRow(row: AuthorRow): AuthorSummary {
  return {
    id: str(row.id),
    username: str(row.username),
    displayName: str(row.display_name),
    avatarMediaId: strOrNull(row.avatar_media_id),
    accountType: str(row.account_type, 'member') as AccountType,
    verified: bool(row.verified),
  }
}

export async function isUsernameTaken(
  db: Db,
  username: string,
  exceptId?: string,
): Promise<boolean> {
  const rows = await db.query<{ taken: boolean }>(
    `select exists (
       select 1 from profiles where lower(username) = $1 and ($2::uuid is null or id <> $2::uuid)
     ) as taken`,
    [normalizeUsername(username), exceptId ?? null],
  )
  return Boolean(rows[0]?.taken)
}

export interface ProfileUpdate {
  displayName: string
  username: string
  bio: string | null
}

/** Set display name, username and bio. Validates the username and its uniqueness. */
export async function updateProfile(db: Db, userId: string, input: ProfileUpdate): Promise<void> {
  const problem = usernameProblem(input.username)
  if (problem) throw new UserFacingError(problem)
  const username = normalizeUsername(input.username)
  if (await isUsernameTaken(db, username, userId)) {
    throw new UserFacingError('That username is taken. Try another.')
  }

  try {
    await db.query(`update profiles set display_name = $2, username = $3, bio = $4 where id = $1`, [
      userId,
      input.displayName,
      username,
      input.bio,
    ])
  } catch (error) {
    // Two people racing for the same name: the unique index decides.
    if ((error as { code?: string }).code === '23505') {
      throw new UserFacingError('That username is taken. Try another.')
    }
    throw error
  }
}

export async function setAvatar(db: Db, userId: string, mediaId: string | null): Promise<void> {
  if (mediaId) {
    const rows = await db.query<{ ok: boolean }>(
      `select exists (select 1 from media where id = $1 and owner_id = $2 and purpose = 'avatar') as ok`,
      [mediaId, userId],
    )
    if (!rows[0]?.ok) throw new UserFacingError('That photo could not be found. Upload it again.')
  }
  const previous = await db.query<{ avatar_media_id: string | null }>(
    'select avatar_media_id from profiles where id = $1',
    [userId],
  )
  await db.query('update profiles set avatar_media_id = $2 where id = $1', [userId, mediaId])
  const old = previous[0]?.avatar_media_id
  if (old && old !== mediaId) await deleteMedia(db, [old], userId)
}

export async function setExploreVisible(db: Db, userId: string, visible: boolean): Promise<void> {
  await db.query('update profiles set explore_visible = $2 where id = $1', [userId, visible])
}

export async function recordConsent(db: Db, userId: string): Promise<void> {
  await db.query(
    `update profiles
        set age_confirmed_at = coalesce(age_confirmed_at, now()),
            terms_accepted_at = coalesce(terms_accepted_at, now())
      where id = $1`,
    [userId],
  )
}

export async function consentState(
  db: Db,
  userId: string,
): Promise<{ consented: boolean; inviteCode: string | null }> {
  const rows = await db.query<{ age: unknown; terms: unknown; invite_code: unknown }>(
    'select age_confirmed_at as age, terms_accepted_at as terms, invite_code from profiles where id = $1',
    [userId],
  )
  const row = rows[0]
  return {
    consented: Boolean(row?.age && row?.terms),
    inviteCode: strOrNull(row?.invite_code),
  }
}

export async function completeOnboarding(db: Db, userId: string): Promise<void> {
  await db.query('update profiles set onboarding_completed = true where id = $1', [userId])
}

/**
 * A public profile by username, as seen by `viewerId` (null when signed out).
 * Null when the account does not exist, is not active, or either side has
 * blocked the other.
 */
export async function getPublicProfile(
  db: Db,
  username: string,
  viewerId: string | null,
): Promise<{ profile: PublicProfile; relationship: Relationship } | null> {
  const rows = await db.query<
    AuthorRow & {
      bio: unknown
      website_url: unknown
      created_at: unknown
      followers: unknown
      following: unknown
      posts: unknown
      viewer_follows: unknown
      viewer_blocks: unknown
    }
  >(
    `select ${AUTHOR_COLUMNS}, p.bio, p.created_at, bd.website_url,
            (select count(*) from follows f join profiles x on x.id = f.follower_id
              where f.followee_id = p.id and x.status = 'active')::int as followers,
            (select count(*) from follows f join profiles x on x.id = f.followee_id
              where f.follower_id = p.id and x.status = 'active')::int as following,
            (select count(*) from posts po where po.author_id = p.id and po.status = 'published')::int as posts,
            exists (select 1 from follows f where f.follower_id = $2::uuid and f.followee_id = p.id) as viewer_follows,
            exists (select 1 from blocks b where b.blocker_id = $2::uuid and b.blocked_id = p.id) as viewer_blocks
       from profiles p
       left join brand_details bd on bd.profile_id = p.id
      where lower(p.username) = $1 and p.status = 'active'`,
    [normalizeUsername(username), viewerId],
  )
  const row = rows[0]
  if (!row) return null

  const id = str(row.id)
  // A block by the profile owner hides the profile from the blocked viewer.
  if (viewerId && viewerId !== id) {
    const blockedByThem = await db.query<{ n: number }>(
      'select count(*)::int as n from blocks where blocker_id = $1 and blocked_id = $2',
      [id, viewerId],
    )
    if ((blockedByThem[0]?.n ?? 0) > 0) return null
  }

  return {
    profile: {
      ...authorFromRow(row),
      bio: strOrNull(row.bio),
      websiteUrl: strOrNull(row.website_url),
      followers: num(row.followers),
      following: num(row.following),
      posts: num(row.posts),
      createdAt: isoDate(row.created_at),
    },
    relationship: {
      isSelf: viewerId === id,
      following: bool(row.viewer_follows),
      blocking: bool(row.viewer_blocks),
    },
  }
}

/** Find an active, visible author by username for the given viewer. */
export async function findAuthorId(db: Db, username: string, viewerId: string | null) {
  const rows = await db.query<{ id: string }>(
    `select p.id from profiles p
      where lower(p.username) = $1 and p.status = 'active'
        and ($2::uuid is null or ${notBlockedSql('$2', 'p.id')})`,
    [normalizeUsername(username), viewerId],
  )
  return rows[0]?.id ?? null
}

/** People to suggest following: brands and recently active creators. */
export async function suggestedAccounts(
  db: Db,
  viewerId: string,
  limit = 8,
): Promise<AuthorSummary[]> {
  const rows = await db.query<AuthorRow>(
    `select ${AUTHOR_COLUMNS} from profiles p
      where p.status = 'active' and p.username is not null and p.id <> $1
        and not exists (select 1 from follows f where f.follower_id = $1 and f.followee_id = p.id)
        and ${notBlockedSql('$1', 'p.id')}
        and exists (select 1 from posts po where po.author_id = p.id and po.status = 'published')
      order by (p.account_type = 'brand') desc,
               (select max(created_at) from posts po where po.author_id = p.id) desc nulls last
      limit $2`,
    [viewerId, limit],
  )
  return rows.map(authorFromRow)
}

/** Search people and brands by username or display name. */
export async function searchAccounts(
  db: Db,
  query: string,
  viewerId: string | null,
  limit = 20,
): Promise<AuthorSummary[]> {
  const term = query.trim().toLowerCase().replace(/^@/, '')
  if (term.length < 2) return []
  const like = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`
  const rows = await db.query<AuthorRow>(
    `select ${AUTHOR_COLUMNS} from profiles p
      where p.status = 'active' and p.username is not null
        and (lower(p.username) like $1 or lower(p.display_name) like $1)
        and ($2::uuid is null or ${notBlockedSql('$2', 'p.id')})
      order by (lower(p.username) = $3) desc, (p.account_type = 'brand') desc, p.username
      limit $4`,
    [like, viewerId, term, limit],
  )
  return rows.map(authorFromRow)
}
