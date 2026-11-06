import 'server-only'
import type { Db } from '@/lib/db/types'
import type { Profile } from '@/types/user'
import type { MediaSize } from './process'
import { getMedia, type MediaRecord } from './repository'

/**
 * Who may see an image. Enforced on every request to /media.
 *
 *   wardrobe   the owner only. Never anyone else, including admins.
 *   avatar     anyone, while the account is active.
 *   post       anyone while the post is published and its author is active;
 *              only the uploader before it is attached to a post (a draft);
 *              only admins once the post is removed.
 *
 * The large size exists only for wardrobe originals.
 */

export type MediaViewer = Pick<Profile, 'id' | 'role'> | null

export type MediaDecision =
  { allowed: false } | { allowed: true; record: MediaRecord; cache: 'private' | 'public' }

export async function decideMediaAccess(
  db: Db,
  mediaId: string,
  size: MediaSize,
  viewer: MediaViewer,
): Promise<MediaDecision> {
  const record = await getMedia(db, mediaId)
  if (!record) return { allowed: false }

  const isOwner = viewer?.id === record.ownerId
  const isAdmin = viewer?.role === 'admin'

  if (record.purpose === 'wardrobe') {
    return isOwner ? { allowed: true, record, cache: 'private' } : { allowed: false }
  }
  if (size === 'lg') return { allowed: false }

  if (record.purpose === 'avatar') {
    const rows = await db.query<{ status: string }>(
      'select status from profiles where avatar_media_id = $1',
      [mediaId],
    )
    const status = rows[0]?.status
    if (!status) return isOwner ? { allowed: true, record, cache: 'private' } : { allowed: false }
    if (status === 'active' || isOwner || isAdmin) {
      return { allowed: true, record, cache: status === 'active' ? 'public' : 'private' }
    }
    return { allowed: false }
  }

  // purpose === 'post'
  const rows = await db.query<{ post_status: string; author_status: string }>(
    `select p.status as post_status, a.status as author_status
       from post_images pi
       join posts p on p.id = pi.post_id
       join profiles a on a.id = p.author_id
      where pi.media_id = $1`,
    [mediaId],
  )
  const attached = rows[0]
  if (!attached) {
    return isOwner ? { allowed: true, record, cache: 'private' } : { allowed: false }
  }
  if (attached.post_status !== 'published') {
    return isAdmin ? { allowed: true, record, cache: 'private' } : { allowed: false }
  }
  if (attached.author_status !== 'active') {
    return isAdmin || isOwner ? { allowed: true, record, cache: 'private' } : { allowed: false }
  }
  return { allowed: true, record, cache: 'public' }
}
