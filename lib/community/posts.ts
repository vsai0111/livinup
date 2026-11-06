import 'server-only'
import { POST_LIMITS } from '@/config/community'
import { OCCASIONS, wardrobeType } from '@/config/wardrobe'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { bool, isoDate, num, str, strOrNull, stringArray } from '@/lib/db/rows'
import { copyForPublishing, deleteMedia, type MediaRecord } from '@/lib/media/repository'
import { assertWithinLimit } from '@/lib/moderation/rate-limit'
import { AUTHOR_COLUMNS, authorFromRow, type AuthorRow } from '@/lib/profiles/repository'
import { humanize } from '@/lib/utils/format'
import type { FeedPage, PostItem, PostView } from '@/types/community'
import { isBlockedEitherWay, notBlockedSql } from './blocks'
import { notify, retractLikeNotification } from './notifications'

/**
 * Posts.
 *
 * A post is a snapshot (docs/product-spec.md 3.3): its images are copies in the
 * public-content bucket and its "What I'm wearing" list is copied text.
 * Publishing never exposes the wardrobe, and later wardrobe changes never
 * change a post.
 *
 * Visibility for anyone other than an admin: the post is published, its author
 * is active, and neither side has blocked the other.
 */

export type PostImageSource =
  | { kind: 'item'; itemId: string; altText: string }
  | { kind: 'upload'; mediaId: string; altText: string }

export interface NewPost {
  outfitId: string | null
  images: PostImageSource[]
  caption: string
  occasions: string[]
  brandIds: string[]
  /** Include the "What I'm wearing" list, built from the outfit's items. */
  includeItems: boolean
}

/* ------------------------------------------------------------------ loading -- */

interface PostRow extends AuthorRow {
  post_id: unknown
  caption: unknown
  occasions: unknown
  status: unknown
  created_at: unknown
  edited_at: unknown
  cursor_ts: unknown
  like_count: unknown
  comment_count: unknown
  liked: unknown
}

function postSelect(viewerParam: string): string {
  return `
    select po.id as post_id, po.caption, po.occasions, po.status, po.created_at, po.edited_at,
           to_char(po.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as cursor_ts,
           ${AUTHOR_COLUMNS},
           (select count(*) from post_likes l join profiles lp on lp.id = l.user_id
             where l.post_id = po.id and lp.status = 'active')::int as like_count,
           (select count(*) from comments c join profiles cp on cp.id = c.author_id
             where c.post_id = po.id and c.status = 'visible' and cp.status = 'active')::int as comment_count,
           exists (select 1 from post_likes l where l.post_id = po.id and l.user_id = ${viewerParam}::uuid) as liked
      from posts po
      join profiles p on p.id = po.author_id`
}

function visibleTo(viewerParam: string): string {
  return `po.status = 'published' and p.status = 'active'
          and (${viewerParam}::uuid is null or ${notBlockedSql(viewerParam, 'po.author_id')})`
}

/** Attach images, items and brand tags to a set of post rows. */
async function hydrate(db: Db, rows: PostRow[]): Promise<PostView[]> {
  if (rows.length === 0) return []
  const ids = rows.map((row) => str(row.post_id))

  const [images, items, brands] = await Promise.all([
    db.query<{
      post_id: string
      media_id: string
      alt_text: string
      width: unknown
      height: unknown
    }>(
      `select pi.post_id::text as post_id, pi.media_id::text as media_id, pi.alt_text, m.width, m.height
         from post_images pi join media m on m.id = pi.media_id
        where pi.post_id = any($1::uuid[])
        order by pi.position`,
      [ids],
    ),
    db.query<{ post_id: string; label: string; color: string | null; brand: string | null }>(
      `select post_id::text as post_id, label, color, brand from post_items
        where post_id = any($1::uuid[]) order by position`,
      [ids],
    ),
    db.query<AuthorRow & { post_id: string }>(
      `select t.post_id::text as post_id, ${AUTHOR_COLUMNS}
         from post_brand_tags t join profiles p on p.id = t.brand_id
        where t.post_id = any($1::uuid[]) and p.status = 'active'`,
      [ids],
    ),
  ])

  return rows.map((row) => {
    const id = str(row.post_id)
    return {
      id,
      author: authorFromRow(row),
      caption: str(row.caption),
      occasions: stringArray(row.occasions),
      images: images
        .filter((image) => image.post_id === id)
        .map((image) => ({
          mediaId: image.media_id,
          altText: image.alt_text,
          width: num(image.width),
          height: num(image.height),
        })),
      items: items
        .filter((item) => item.post_id === id)
        .map((item): PostItem => ({ label: item.label, color: item.color, brand: item.brand })),
      brands: brands.filter((brand) => brand.post_id === id).map(authorFromRow),
      likeCount: num(row.like_count),
      commentCount: num(row.comment_count),
      likedByViewer: bool(row.liked),
      status: str(row.status) as PostView['status'],
      createdAt: isoDate(row.created_at),
      editedAt: row.edited_at ? isoDate(row.edited_at) : null,
    }
  })
}

/** One post as `viewerId` may see it. Admins also see removed posts. */
export async function getPost(
  db: Db,
  postId: string,
  viewer: { id: string; role: string } | null,
): Promise<PostView | null> {
  const isAdmin = viewer?.role === 'admin'
  const rows = await db.query<PostRow>(
    `${postSelect('$2')}
      where po.id = $1 and (${isAdmin ? 'true' : visibleTo('$2')})`,
    [postId, viewer?.id ?? null],
  )
  const [post] = await hydrate(db, rows)
  return post ?? null
}

/** A removed post's author can still learn that it was removed. */
export async function getRemovedPostForAuthor(db: Db, postId: string, authorId: string) {
  const rows = await db.query<{ removed_reason: string | null }>(
    `select removed_reason from posts where id = $1 and author_id = $2 and status = 'removed'`,
    [postId, authorId],
  )
  return rows[0] ? { reason: rows[0].removed_reason } : null
}

/* ------------------------------------------------------------------- feeds -- */

function encodeCursor(createdAt: string, id: string): string {
  return Buffer.from(`${createdAt}|${id}`).toString('base64url')
}

function decodeCursor(cursor: string | null | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null
  try {
    const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|')
    if (!createdAt || !id || Number.isNaN(Date.parse(createdAt))) return null
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

async function page(db: Db, rows: PostRow[], limit: number): Promise<FeedPage> {
  const hasMore = rows.length > limit
  const visible = rows.slice(0, limit)
  const posts = await hydrate(db, visible)
  // The cursor carries microsecond precision; a millisecond ISO string would
  // skip posts created within the same millisecond as the page boundary.
  const last = visible[visible.length - 1]
  return {
    posts,
    nextCursor: hasMore && last ? encodeCursor(str(last.cursor_ts), str(last.post_id)) : null,
  }
}

/** Posts from accounts the viewer follows, and the viewer's own. Newest first. */
export async function followingFeed(
  db: Db,
  viewerId: string,
  options: { cursor?: string | null; limit: number },
): Promise<FeedPage> {
  const cursor = decodeCursor(options.cursor)
  const rows = await db.query<PostRow>(
    `${postSelect('$1')}
      where ${visibleTo('$1')}
        and (po.author_id = $1
             or exists (select 1 from follows f where f.follower_id = $1 and f.followee_id = po.author_id))
        and ($2::timestamptz is null or (po.created_at, po.id) < ($2::timestamptz, $3::uuid))
      order by po.created_at desc, po.id desc
      limit $4`,
    [viewerId, cursor?.createdAt ?? null, cursor?.id ?? null, options.limit + 1],
  )
  return page(db, rows, options.limit)
}

/** Recent public posts from everyone who has not opted out of Explore. */
export async function exploreFeed(
  db: Db,
  viewerId: string | null,
  options: { cursor?: string | null; limit: number; occasion?: string | null },
): Promise<FeedPage> {
  const cursor = decodeCursor(options.cursor)
  const rows = await db.query<PostRow>(
    `${postSelect('$1')}
      where ${visibleTo('$1')}
        and (p.explore_visible or po.author_id = $1::uuid)
        and ($2::text is null or $2 = any(po.occasions))
        and ($3::timestamptz is null or (po.created_at, po.id) < ($3::timestamptz, $4::uuid))
      order by po.created_at desc, po.id desc
      limit $5`,
    [
      viewerId,
      options.occasion ?? null,
      cursor?.createdAt ?? null,
      cursor?.id ?? null,
      options.limit + 1,
    ],
  )
  return page(db, rows, options.limit)
}

/** A profile's posts. */
export async function authorPosts(
  db: Db,
  authorId: string,
  viewerId: string | null,
  options: { cursor?: string | null; limit: number },
): Promise<FeedPage> {
  const cursor = decodeCursor(options.cursor)
  const rows = await db.query<PostRow>(
    `${postSelect('$2')}
      where po.author_id = $1 and ${visibleTo('$2')}
        and ($3::timestamptz is null or (po.created_at, po.id) < ($3::timestamptz, $4::uuid))
      order by po.created_at desc, po.id desc
      limit $5`,
    [authorId, viewerId, cursor?.createdAt ?? null, cursor?.id ?? null, options.limit + 1],
  )
  return page(db, rows, options.limit)
}

/** Posts that tag a brand. */
export async function brandTaggedPosts(
  db: Db,
  brandId: string,
  viewerId: string | null,
  limit: number,
): Promise<PostView[]> {
  const rows = await db.query<PostRow>(
    `${postSelect('$2')}
      where ${visibleTo('$2')}
        and exists (select 1 from post_brand_tags t where t.post_id = po.id and t.brand_id = $1)
      order by po.created_at desc, po.id desc
      limit $3`,
    [brandId, viewerId, limit],
  )
  return hydrate(db, rows)
}

/* ---------------------------------------------------------------- publishing -- */

function cleanOccasions(values: readonly string[]): string[] {
  const allowed = new Set<string>(OCCASIONS)
  return [...new Set(values)].filter((value) => allowed.has(value)).slice(0, 10)
}

/**
 * Publish a post. Everything is checked against the author's own data on the
 * server; nothing in the request is trusted to belong to them.
 */
export async function createPost(db: Db, authorId: string, input: NewPost): Promise<string> {
  if (input.images.length < 1) throw new UserFacingError('Add at least one photo.')
  if (input.images.length > POST_LIMITS.images) {
    throw new UserFacingError(`A post can have up to ${POST_LIMITS.images} photos.`)
  }
  await assertWithinLimit(db, authorId, 'post')

  // The outfit, if given, must be the author's.
  let outfitItemIds: string[] = []
  if (input.outfitId) {
    const outfit = await db.query<{ item_ids: unknown }>(
      `select coalesce((select array_agg(item_id::text order by position) from outfit_items
                         where outfit_id = o.id), '{}') as item_ids
         from outfits o where o.id = $1 and o.user_id = $2`,
      [input.outfitId, authorId],
    )
    if (!outfit[0]) throw new UserFacingError('That outfit could not be found.')
    outfitItemIds = stringArray(outfit[0].item_ids)
  }

  // Resolve each image to a media row the author owns.
  const sources: Array<{ mediaId: string; altText: string }> = []
  for (const image of input.images) {
    if (image.kind === 'item') {
      const rows = await db.query<{ media_id: string | null }>(
        'select media_id::text as media_id from wardrobe_items where id = $1 and user_id = $2',
        [image.itemId, authorId],
      )
      if (!rows[0]?.media_id) throw new UserFacingError('One of those pieces has no photo.')
      sources.push({ mediaId: rows[0].media_id, altText: image.altText })
    } else {
      const rows = await db.query<{ ok: boolean }>(
        `select exists (
           select 1 from media m where m.id = $1 and m.owner_id = $2 and m.purpose = 'post'
              and not exists (select 1 from post_images pi where pi.media_id = m.id)
         ) as ok`,
        [image.mediaId, authorId],
      )
      if (!rows[0]?.ok)
        throw new UserFacingError('One of those photos could not be found. Upload it again.')
      sources.push({ mediaId: image.mediaId, altText: image.altText })
    }
  }

  // Brand tags: verified brands only, no duplicates.
  const brandIds = [...new Set(input.brandIds)].slice(0, POST_LIMITS.brandTags)
  if (brandIds.length > 0) {
    const valid = await db.query<{ id: string }>(
      `select p.id::text as id from profiles p join brand_details b on b.profile_id = p.id
        where p.id = any($1::uuid[]) and p.account_type = 'brand' and p.status = 'active'
          and b.verified_at is not null`,
      [brandIds],
    )
    if (valid.length !== brandIds.length)
      throw new UserFacingError('One of the tagged brands is not available.')
  }

  // The "What I'm wearing" snapshot: type, colour and brand only, never notes.
  let snapshot: PostItem[] = []
  if (input.includeItems && outfitItemIds.length > 0) {
    const rows = await db.query<{
      item_type: string
      color: string
      brand_text: string | null
      brand_name: string | null
    }>(
      `select w.item_type, w.color, w.brand_text, bp.display_name as brand_name
         from wardrobe_items w left join profiles bp on bp.id = w.brand_profile_id
        where w.user_id = $1 and w.id = any($2::uuid[])`,
      [authorId, outfitItemIds],
    )
    snapshot = rows.map((row) => ({
      label: wardrobeType(row.item_type)?.label ?? humanize(row.item_type),
      color: row.color,
      brand: row.brand_name ?? row.brand_text,
    }))
  }

  // Copy every image into public-content. Wardrobe photos are copied;
  // direct post uploads already live there and are attached as they are.
  const copies: MediaRecord[] = []
  const attach: Array<{ mediaId: string; altText: string }> = []
  try {
    for (const source of sources) {
      const purpose = await db.query<{ purpose: string }>(
        'select purpose from media where id = $1',
        [source.mediaId],
      )
      if (purpose[0]?.purpose === 'wardrobe') {
        const copy = await copyForPublishing(db, authorId, source.mediaId)
        copies.push(copy)
        attach.push({ mediaId: copy.id, altText: source.altText })
      } else {
        attach.push(source)
      }
    }

    return await db.transaction(async (tx) => {
      const created = await tx.query<{ id: string }>(
        `insert into posts (author_id, outfit_id, caption, occasions)
         values ($1, $2, $3, $4) returning id`,
        [authorId, input.outfitId, input.caption.trim(), cleanOccasions(input.occasions)],
      )
      const postId = created[0].id

      for (const [index, image] of attach.entries()) {
        await tx.query(
          `insert into post_images (post_id, media_id, position, alt_text) values ($1, $2, $3, $4)`,
          [postId, image.mediaId, index + 1, image.altText.slice(0, POST_LIMITS.altTextLength)],
        )
      }
      for (const [index, item] of snapshot.entries()) {
        await tx.query(
          `insert into post_items (post_id, position, label, color, brand) values ($1, $2, $3, $4, $5)`,
          [postId, index, item.label.slice(0, 60), item.color, item.brand?.slice(0, 60) ?? null],
        )
      }
      for (const brandId of brandIds) {
        await tx.query('insert into post_brand_tags (post_id, brand_id) values ($1, $2)', [
          postId,
          brandId,
        ])
      }
      return postId
    })
  } catch (error) {
    // Nothing references the copies if the post was not created.
    await deleteMedia(
      db,
      copies.map((copy) => copy.id),
      authorId,
    ).catch(() => {})
    throw error
  }
}

export async function editCaption(db: Db, authorId: string, postId: string, caption: string) {
  const rows = await db.query<{ id: string }>(
    `update posts set caption = $3, edited_at = now()
      where id = $1 and author_id = $2 and status = 'published' returning id`,
    [postId, authorId, caption.trim()],
  )
  if (rows.length === 0) throw new UserFacingError('That post could not be found.')
}

/** The author deletes a post: the post, its images and their files all go. */
export async function deletePost(db: Db, authorId: string, postId: string): Promise<boolean> {
  const media = await db.query<{ media_id: string }>(
    `select pi.media_id::text as media_id from post_images pi
       join posts p on p.id = pi.post_id where p.id = $1 and p.author_id = $2`,
    [postId, authorId],
  )
  const removed = await db.query<{ id: string }>(
    'delete from posts where id = $1 and author_id = $2 returning id',
    [postId, authorId],
  )
  if (removed.length === 0) return false
  await deleteMedia(
    db,
    media.map((row) => row.media_id),
    authorId,
  )
  return true
}

/* -------------------------------------------------------------------- likes -- */

async function assertCanInteract(db: Db, viewerId: string, postId: string): Promise<string> {
  const rows = await db.query<{ author_id: string }>(
    `select po.author_id::text as author_id from posts po join profiles p on p.id = po.author_id
      where po.id = $1 and ${visibleTo('$2')}`,
    [postId, viewerId],
  )
  const authorId = rows[0]?.author_id
  if (!authorId) throw new UserFacingError('That post is not available.')
  return authorId
}

export async function setLike(
  db: Db,
  userId: string,
  postId: string,
  liked: boolean,
): Promise<{ liked: boolean; likeCount: number }> {
  const authorId = await assertCanInteract(db, userId, postId)

  if (liked) {
    const inserted = await db.query<{ post_id: string }>(
      `insert into post_likes (user_id, post_id) values ($1, $2)
       on conflict do nothing returning post_id`,
      [userId, postId],
    )
    if (inserted.length > 0) {
      await notify(db, { recipientId: authorId, actorId: userId, type: 'like', postId })
    }
  } else {
    await db.query('delete from post_likes where user_id = $1 and post_id = $2', [userId, postId])
    await retractLikeNotification(db, userId, postId)
  }

  const count = await db.query<{ n: number }>(
    `select count(*)::int as n from post_likes l join profiles p on p.id = l.user_id
      where l.post_id = $1 and p.status = 'active'`,
    [postId],
  )
  return { liked, likeCount: count[0]?.n ?? 0 }
}

/* ----------------------------------------------------------------- comments -- */

export async function addComment(
  db: Db,
  userId: string,
  postId: string,
  body: string,
): Promise<string> {
  const text = body.trim()
  if (text.length === 0) throw new UserFacingError('Write something first.')
  if (text.length > POST_LIMITS.commentLength) {
    throw new UserFacingError(`Comments can be up to ${POST_LIMITS.commentLength} characters.`)
  }
  const authorId = await assertCanInteract(db, userId, postId)
  if (await isBlockedEitherWay(db, userId, authorId)) {
    throw new UserFacingError('That post is not available.')
  }
  await assertWithinLimit(db, userId, 'comment')

  const rows = await db.query<{ id: string }>(
    'insert into comments (post_id, author_id, body) values ($1, $2, $3) returning id',
    [postId, userId, text],
  )
  const commentId = rows[0].id
  await notify(db, { recipientId: authorId, actorId: userId, type: 'comment', postId, commentId })
  return commentId
}

/** The commenter, or the post's author, deletes a comment. */
export async function deleteComment(db: Db, userId: string, commentId: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `delete from comments c
      where c.id = $1
        and (c.author_id = $2 or exists (select 1 from posts p where p.id = c.post_id and p.author_id = $2))
      returning c.id`,
    [commentId, userId],
  )
  return rows.length > 0
}

export async function listComments(
  db: Db,
  postId: string,
  viewerId: string,
  limit: number,
): Promise<import('@/types/community').CommentView[]> {
  const rows = await db.query<
    AuthorRow & { comment_id: unknown; body: unknown; created_at: unknown; post_author: unknown }
  >(
    `select c.id as comment_id, c.body, c.created_at, po.author_id as post_author, ${AUTHOR_COLUMNS}
       from comments c
       join posts po on po.id = c.post_id
       join profiles p on p.id = c.author_id
      where c.post_id = $1 and c.status = 'visible' and p.status = 'active'
        and ${notBlockedSql('$2', 'c.author_id')}
      order by c.created_at, c.id
      limit $3`,
    [postId, viewerId, limit],
  )
  return rows.map((row) => {
    const author = authorFromRow(row)
    return {
      id: str(row.comment_id),
      postId,
      author,
      body: str(row.body),
      createdAt: isoDate(row.created_at),
      canDelete: author.id === viewerId || strOrNull(row.post_author) === viewerId,
    }
  })
}
