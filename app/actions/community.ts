'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { POST_LIMITS, REPORT_REASONS } from '@/config/community'
import { OCCASIONS } from '@/config/wardrobe'
import { fail, UserFacingError, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { recordEvent } from '@/lib/analytics/events'
import { getSessionId } from '@/lib/analytics/session'
import { getSessionUser } from '@/lib/auth'
import { blockUser, unblockUser } from '@/lib/community/blocks'
import { follow, unfollow } from '@/lib/community/follows'
import { markAllRead } from '@/lib/community/notifications'
import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  editCaption,
  setLike,
} from '@/lib/community/posts'
import { getDb } from '@/lib/db'
import { createReport } from '@/lib/moderation/reports'

/**
 * Community Server Actions: publishing, following, likes, comments, reports,
 * blocks. Visibility, blocks and rate limits are enforced in lib/community;
 * these validate input and take the user from the session.
 */

const uuid = z.string().uuid()

const publishSchema = z.object({
  outfitId: uuid.nullish().transform((v) => v ?? null),
  images: z
    .array(
      z.discriminatedUnion('kind', [
        z.object({
          kind: z.literal('item'),
          itemId: uuid,
          altText: z.string().max(POST_LIMITS.altTextLength),
        }),
        z.object({
          kind: z.literal('upload'),
          mediaId: uuid,
          altText: z.string().max(POST_LIMITS.altTextLength),
        }),
      ]),
    )
    .min(1)
    .max(POST_LIMITS.images),
  caption: z.string().max(POST_LIMITS.captionLength),
  occasions: z.array(z.enum(OCCASIONS)).max(10),
  brandIds: z.array(uuid).max(POST_LIMITS.brandTags),
  includeItems: z.boolean(),
})

export async function publishPostAction(input: unknown): Promise<ActionResult<{ postId: string }>> {
  const parsed = publishSchema.safeParse(input)
  if (!parsed.success) return fail('Add at least one photo, and check the caption length.')

  return runAction('publishPost', async (session) => {
    if (!session.profile.username) throw new UserFacingError('Choose a username before posting.')
    const db = await getDb()
    const postId = await createPost(db, session.id, {
      ...parsed.data,
      occasions: [...parsed.data.occasions],
    })
    await recordEvent(db, {
      userId: session.id,
      eventType: 'post_published',
      metadata: {
        images: parsed.data.images.length,
        fromOutfit: Boolean(parsed.data.outfitId),
        brandTags: parsed.data.brandIds.length,
      },
    })
    revalidatePath('/home')
    revalidatePath(`/u/${session.profile.username}`)
    return { postId }
  })
}

export async function editCaptionAction(postId: string, caption: string): Promise<ActionResult> {
  const id = uuid.safeParse(postId)
  const text = z.string().max(POST_LIMITS.captionLength).safeParse(caption)
  if (!id.success || !text.success) return fail('That caption is too long.')
  return runAction('editCaption', async (session) => {
    const db = await getDb()
    await editCaption(db, session.id, id.data, text.data)
    revalidatePath(`/p/${id.data}`)
    return undefined
  }) as Promise<ActionResult>
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  const id = uuid.safeParse(postId)
  if (!id.success) return fail('That post could not be found.')
  return runAction(
    'deletePost',
    async (session) => {
      const db = await getDb()
      const removed = await deletePost(db, session.id, id.data)
      if (!removed) throw new UserFacingError('That post could not be found.')
      await recordEvent(db, { userId: session.id, eventType: 'post_deleted' })
      revalidatePath('/home')
      if (session.profile.username) revalidatePath(`/u/${session.profile.username}`)
      return undefined
    },
    // A suspended member may still remove their own content.
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

export async function setLikeAction(
  postId: string,
  liked: boolean,
): Promise<ActionResult<{ liked: boolean; likeCount: number }>> {
  const id = uuid.safeParse(postId)
  if (!id.success) return fail('That post could not be found.')
  return runAction('setLike', async (session) => {
    const db = await getDb()
    const result = await setLike(db, session.id, id.data, liked)
    if (liked) await recordEvent(db, { userId: session.id, eventType: 'post_liked' })
    return result
  })
}

export async function addCommentAction(postId: string, body: string): Promise<ActionResult> {
  const id = uuid.safeParse(postId)
  if (!id.success) return fail('That post could not be found.')
  return runAction('addComment', async (session) => {
    const db = await getDb()
    await addComment(db, session.id, id.data, body)
    await recordEvent(db, { userId: session.id, eventType: 'comment_added' })
    revalidatePath(`/p/${id.data}`)
    return undefined
  }) as Promise<ActionResult>
}

export async function deleteCommentAction(
  commentId: string,
  postId: string,
): Promise<ActionResult> {
  const id = uuid.safeParse(commentId)
  const post = uuid.safeParse(postId)
  if (!id.success || !post.success) return fail('That comment could not be found.')
  return runAction(
    'deleteComment',
    async (session) => {
      const db = await getDb()
      const removed = await deleteComment(db, session.id, id.data)
      if (!removed) throw new UserFacingError('That comment could not be found.')
      revalidatePath(`/p/${post.data}`)
      return undefined
    },
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

export async function setFollowAction(
  profileId: string,
  following: boolean,
): Promise<ActionResult<{ following: boolean }>> {
  const id = uuid.safeParse(profileId)
  if (!id.success) return fail('That account could not be found.')
  return runAction('setFollow', async (session) => {
    const db = await getDb()
    if (following) {
      const added = await follow(db, session.id, id.data)
      if (added) await recordEvent(db, { userId: session.id, eventType: 'follow_added' })
    } else {
      await unfollow(db, session.id, id.data)
    }
    revalidatePath('/home')
    return { following }
  })
}

export async function setBlockAction(profileId: string, blocked: boolean): Promise<ActionResult> {
  const id = uuid.safeParse(profileId)
  if (!id.success) return fail('That account could not be found.')
  return runAction(
    'setBlock',
    async (session) => {
      if (id.data === session.id) throw new UserFacingError('You cannot block yourself.')
      const db = await getDb()
      if (blocked) await blockUser(db, session.id, id.data)
      else await unblockUser(db, session.id, id.data)
      revalidatePath('/home')
      revalidatePath('/settings')
      return undefined
    },
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

const reportSchema = z.object({
  targetType: z.enum(['post', 'comment', 'profile']),
  targetId: uuid,
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .trim()
    .max(1000)
    .nullish()
    .transform((v) => (v ? v : null)),
})

export async function reportAction(input: unknown): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input)
  if (!parsed.success) return fail('Choose a reason for the report.')
  return runAction(
    'report',
    async (session) => {
      const db = await getDb()
      await createReport(db, session.id, parsed.data)
      await recordEvent(db, {
        userId: session.id,
        eventType: 'report_submitted',
        metadata: { targetType: parsed.data.targetType, reason: parsed.data.reason },
      })
      return undefined
    },
    // Reporting is a safety tool; a suspended account keeps it.
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

export async function markNotificationsReadAction(): Promise<ActionResult> {
  return runAction(
    'markRead',
    async (session) => {
      const db = await getDb()
      await markAllRead(db, session.id)
      return undefined
    },
    { allowSuspended: true },
  ) as Promise<ActionResult>
}

/** Analytics only: someone used the share button. Works signed out too. */
export async function recordShareAction(kind: 'post' | 'profile'): Promise<void> {
  const db = await getDb()
  const session = await getSessionUser()
  await recordEvent(db, {
    userId: session?.id ?? null,
    sessionId: await getSessionId(),
    eventType: 'share_clicked',
    metadata: { kind },
  })
}
