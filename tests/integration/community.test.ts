import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { deleteAccount } from '@/lib/account/delete'
import { blockUser, unblockUser } from '@/lib/community/blocks'
import { follow } from '@/lib/community/follows'
import { unreadCount } from '@/lib/community/notifications'
import {
  addComment,
  createPost,
  deletePost,
  exploreFeed,
  followingFeed,
  getPost,
  listComments,
  setLike,
} from '@/lib/community/posts'
import { decideMediaAccess } from '@/lib/media/access'
import { getMedia, storeUpload, variantKey } from '@/lib/media/repository'
import { setImageStoreForTests, type Bucket, type ImageStore } from '@/lib/media/store'
import { createReport, resolveReport } from '@/lib/moderation/reports'
import { createItem, saveOutfit } from '@/lib/wardrobe/repository'
import { makeBrand, setBrandVerified } from '@/lib/brands/repository'
import { createTestDb, createTestUser, type TestDb } from '../helpers/db'

/**
 * The v1 data layer against a real, migrated database: wardrobe privacy,
 * publishing, feeds, blocking, moderation and account deletion.
 */

class MemoryStore implements ImageStore {
  readonly kind = 'local' as const
  files = new Map<string, Buffer>()
  async put(bucket: Bucket, key: string, body: Buffer) {
    this.files.set(`${bucket}/${key}`, body)
  }
  async get(bucket: Bucket, key: string) {
    return this.files.get(`${bucket}/${key}`) ?? null
  }
  async remove(bucket: Bucket, keys: readonly string[]) {
    for (const key of keys) this.files.delete(`${bucket}/${key}`)
  }
}

let ctx: TestDb
let store: MemoryStore
let photo: Buffer

beforeAll(async () => {
  ctx = await createTestDb()
  store = new MemoryStore()
  setImageStoreForTests(store)
  photo = await sharp({
    create: { width: 400, height: 500, channels: 3, background: { r: 120, g: 40, b: 60 } },
  })
    .jpeg()
    .toBuffer()
}, 120_000)

afterAll(async () => {
  setImageStoreForTests(undefined)
  await ctx?.close()
})

async function wardrobePiece(userId: string, itemType: string) {
  const media = await storeUpload(ctx.db, userId, 'wardrobe', photo)
  return createItem(ctx.db, userId, {
    name: itemType,
    itemType,
    color: 'maroon',
    secondaryColor: null,
    material: 'silk',
    brandText: null,
    brandProfileId: null,
    notes: 'bought in Jaipur, my secret note',
    mediaId: media.id,
  })
}

describe('wardrobe photos', () => {
  it('are re-encoded, stripped and visible only to their owner', async () => {
    const owner = await createTestUser(ctx.db)
    const other = await createTestUser(ctx.db)
    const admin = await createTestUser(ctx.db)
    await ctx.db.query(`update profiles set role = 'admin' where id = $1`, [admin.id])

    const media = await storeUpload(ctx.db, owner.id, 'wardrobe', photo)
    expect(media.bucket).toBe('wardrobe')
    const stored = store.files.get(`wardrobe/${variantKey(media.storageKey, 'md')}`)
    expect(stored).toBeDefined()
    expect((await sharp(stored!).metadata()).format).toBe('webp')

    const asOwner = await decideMediaAccess(ctx.db, media.id, 'md', {
      id: owner.id,
      role: 'member',
    })
    expect(asOwner.allowed).toBe(true)
    const viewers = [
      null,
      { id: other.id, role: 'member' as const },
      { id: admin.id, role: 'admin' as const },
    ]
    for (const viewer of viewers) {
      expect((await decideMediaAccess(ctx.db, media.id, 'md', viewer)).allowed).toBe(false)
    }
  })

  it('cannot be attached to another user’s wardrobe item', async () => {
    const owner = await createTestUser(ctx.db)
    const thief = await createTestUser(ctx.db)
    const media = await storeUpload(ctx.db, owner.id, 'wardrobe', photo)
    await expect(
      createItem(ctx.db, thief.id, {
        name: 'Stolen',
        itemType: 'kurta',
        color: 'red',
        secondaryColor: null,
        material: null,
        brandText: null,
        brandProfileId: null,
        notes: null,
        mediaId: media.id,
      }),
    ).rejects.toThrow(/could not be found/)
  })
})

describe('outfits', () => {
  it('saves a saree look and refuses someone else’s pieces', async () => {
    const user = await createTestUser(ctx.db)
    const other = await createTestUser(ctx.db)
    const saree = await wardrobePiece(user.id, 'saree')
    const blouse = await wardrobePiece(user.id, 'blouse')
    const foreign = await wardrobePiece(other.id, 'heels')

    const outfit = await saveOutfit(ctx.db, user.id, {
      name: 'Diwali',
      occasions: ['festive'],
      notes: null,
      itemIds: [saree.id, blouse.id],
    })
    expect(outfit.itemIds).toEqual([saree.id, blouse.id])

    await expect(
      saveOutfit(ctx.db, user.id, {
        name: 'Borrowed',
        occasions: [],
        notes: null,
        itemIds: [saree.id, foreign.id],
      }),
    ).rejects.toThrow(/no longer in your wardrobe/)
  })

  it('enforces zone rules on the server', async () => {
    const user = await createTestUser(ctx.db)
    const dress = await wardrobePiece(user.id, 'dress')
    const jeans = await wardrobePiece(user.id, 'jeans')
    await expect(
      saveOutfit(ctx.db, user.id, {
        name: 'x',
        occasions: [],
        notes: null,
        itemIds: [dress.id, jeans.id],
      }),
    ).rejects.toThrow(/Only one item/)
  })
})

describe('publishing', () => {
  it('copies the photo, keeps the wardrobe private and never copies notes', async () => {
    const author = await createTestUser(ctx.db)
    const kurta = await wardrobePiece(author.id, 'kurta')
    const outfit = await saveOutfit(ctx.db, author.id, {
      name: 'Office',
      occasions: ['work'],
      notes: null,
      itemIds: [kurta.id],
    })

    const postId = await createPost(ctx.db, author.id, {
      outfitId: outfit.id,
      images: [{ kind: 'item', itemId: kurta.id, altText: 'Maroon kurta' }],
      caption: '  Monday  ',
      occasions: ['work', 'not-an-occasion'],
      brandIds: [],
      includeItems: true,
    })

    const post = await getPost(ctx.db, postId, null)
    expect(post?.caption).toBe('Monday')
    expect(post?.occasions).toEqual(['work'])
    expect(post?.items).toEqual([{ label: 'Kurta', color: 'maroon', brand: null }])
    expect(JSON.stringify(post)).not.toContain('secret note')

    const published = await getMedia(ctx.db, post!.images[0]!.mediaId)
    expect(published?.purpose).toBe('post')
    expect(published?.bucket).toBe('public-content')
    expect(published?.id).not.toBe(kurta.mediaId)

    // The public copy is visible to strangers; the wardrobe original still is not.
    expect((await decideMediaAccess(ctx.db, published!.id, 'md', null)).allowed).toBe(true)
    expect((await decideMediaAccess(ctx.db, kurta.mediaId!, 'md', null)).allowed).toBe(false)
    // There is no large size for published images.
    expect((await decideMediaAccess(ctx.db, published!.id, 'lg', null)).allowed).toBe(false)
  })

  it('refuses another user’s wardrobe item as a post image', async () => {
    const owner = await createTestUser(ctx.db)
    const author = await createTestUser(ctx.db)
    const item = await wardrobePiece(owner.id, 'shirt')
    await expect(
      createPost(ctx.db, author.id, {
        outfitId: null,
        images: [{ kind: 'item', itemId: item.id, altText: '' }],
        caption: '',
        occasions: [],
        brandIds: [],
        includeItems: false,
      }),
    ).rejects.toThrow(/no photo/)
  })

  it('only accepts verified brands as tags', async () => {
    const author = await createTestUser(ctx.db)
    const brand = await createTestUser(ctx.db, { displayName: 'Brand' })
    const admin = await createTestUser(ctx.db)
    const item = await wardrobePiece(author.id, 'shirt')
    const input = {
      outfitId: null,
      images: [{ kind: 'item' as const, itemId: item.id, altText: '' }],
      caption: '',
      occasions: [],
      brandIds: [brand.id],
      includeItems: false,
    }

    await makeBrand(ctx.db, brand.id, 'https://brand.example')
    await expect(createPost(ctx.db, author.id, input)).rejects.toThrow(/brands is not available/)

    await setBrandVerified(ctx.db, brand.id, admin.id, true)
    const postId = await createPost(ctx.db, author.id, input)
    expect((await getPost(ctx.db, postId, null))?.brands.map((b) => b.id)).toEqual([brand.id])
  })

  it('deletes the post’s images when the post is deleted', async () => {
    const author = await createTestUser(ctx.db)
    const item = await wardrobePiece(author.id, 'shirt')
    const postId = await createPost(ctx.db, author.id, {
      outfitId: null,
      images: [{ kind: 'item', itemId: item.id, altText: '' }],
      caption: '',
      occasions: [],
      brandIds: [],
      includeItems: false,
    })
    const mediaId = (await getPost(ctx.db, postId, null))!.images[0]!.mediaId
    const record = await getMedia(ctx.db, mediaId)

    expect(await deletePost(ctx.db, author.id, postId)).toBe(true)
    expect(await getMedia(ctx.db, mediaId)).toBeNull()
    expect(store.files.has(`public-content/${variantKey(record!.storageKey, 'md')}`)).toBe(false)
    // The wardrobe item and its photo are untouched.
    expect(await getMedia(ctx.db, item.mediaId!)).not.toBeNull()
  })
})

async function simplePost(authorId: string, caption = '') {
  const item = await wardrobePiece(authorId, 't-shirt')
  return createPost(ctx.db, authorId, {
    outfitId: null,
    images: [{ kind: 'item', itemId: item.id, altText: '' }],
    caption,
    occasions: [],
    brandIds: [],
    includeItems: false,
  })
}

describe('feeds, likes, comments and notifications', () => {
  it('shows followed accounts in the following feed and notifies on activity', async () => {
    const asha = await createTestUser(ctx.db)
    const ravi = await createTestUser(ctx.db)
    const stranger = await createTestUser(ctx.db)
    const postId = await simplePost(asha.id, 'Hello')
    await simplePost(stranger.id, 'Not followed')

    expect(await follow(ctx.db, ravi.id, asha.id)).toBe(true)
    const feed = await followingFeed(ctx.db, ravi.id, { limit: 20 })
    expect(feed.posts.map((post) => post.id)).toEqual([postId])

    await setLike(ctx.db, ravi.id, postId, true)
    await setLike(ctx.db, ravi.id, postId, true) // idempotent
    await addComment(ctx.db, ravi.id, postId, 'Lovely colour')
    const post = await getPost(ctx.db, postId, { id: ravi.id, role: 'member' })
    expect(post?.likeCount).toBe(1)
    expect(post?.likedByViewer).toBe(true)
    expect(post?.commentCount).toBe(1)

    // follow + like + comment
    expect(await unreadCount(ctx.db, asha.id)).toBeGreaterThanOrEqual(3)
  })

  it('pages through the explore feed without skipping or repeating posts', async () => {
    const author = await createTestUser(ctx.db)
    const created: string[] = []
    for (let i = 0; i < 5; i++) created.push(await simplePost(author.id, `post ${i}`))

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const result = await exploreFeed(ctx.db, null, { cursor, limit: 2 })
      seen.push(...result.posts.map((post) => post.id))
      cursor = result.nextCursor
    } while (cursor)

    expect(new Set(seen).size).toBe(seen.length)
    for (const id of created) expect(seen).toContain(id)
  })

  it('hides accounts that opted out of Explore, but not from their own view', async () => {
    const hidden = await createTestUser(ctx.db)
    await ctx.db.query('update profiles set explore_visible = false where id = $1', [hidden.id])
    const postId = await simplePost(hidden.id)
    const anonymous = await exploreFeed(ctx.db, null, { limit: 100 })
    expect(anonymous.posts.map((post) => post.id)).not.toContain(postId)
    const own = await exploreFeed(ctx.db, hidden.id, { limit: 100 })
    expect(own.posts.map((post) => post.id)).toContain(postId)
  })
})

describe('blocking', () => {
  it('hides posts both ways, removes follows and stops interaction', async () => {
    const a = await createTestUser(ctx.db)
    const b = await createTestUser(ctx.db)
    const postId = await simplePost(b.id)
    await follow(ctx.db, a.id, b.id)

    await blockUser(ctx.db, b.id, a.id)

    expect(await getPost(ctx.db, postId, { id: a.id, role: 'member' })).toBeNull()
    expect((await followingFeed(ctx.db, a.id, { limit: 20 })).posts).toEqual([])
    await expect(setLike(ctx.db, a.id, postId, true)).rejects.toThrow(/not available/)
    await expect(addComment(ctx.db, a.id, postId, 'hi')).rejects.toThrow(/not available/)
    await expect(follow(ctx.db, a.id, b.id)).rejects.toThrow(/not available/)

    const follows = await ctx.db.query(
      'select 1 from follows where follower_id = $1 and followee_id = $2',
      [a.id, b.id],
    )
    expect(follows).toEqual([])

    await unblockUser(ctx.db, b.id, a.id)
    expect(await getPost(ctx.db, postId, { id: a.id, role: 'member' })).not.toBeNull()
  })

  it('hides comments from blocked accounts', async () => {
    const author = await createTestUser(ctx.db)
    const commenter = await createTestUser(ctx.db)
    const reader = await createTestUser(ctx.db)
    const postId = await simplePost(author.id)
    await addComment(ctx.db, commenter.id, postId, 'from commenter')
    await blockUser(ctx.db, reader.id, commenter.id)

    const visible = await listComments(ctx.db, postId, reader.id, 50)
    expect(visible.map((comment) => comment.body)).not.toContain('from commenter')
  })
})

describe('moderation', () => {
  it('removes a reported post, closes duplicate reports and tells everyone involved', async () => {
    const author = await createTestUser(ctx.db)
    const reporter1 = await createTestUser(ctx.db)
    const reporter2 = await createTestUser(ctx.db)
    const admin = await createTestUser(ctx.db)
    await ctx.db.query(`update profiles set role = 'admin' where id = $1`, [admin.id])
    const postId = await simplePost(author.id)

    await createReport(ctx.db, reporter1.id, {
      targetType: 'post',
      targetId: postId,
      reason: 'intimate_image',
      details: null,
    })
    await createReport(ctx.db, reporter2.id, {
      targetType: 'post',
      targetId: postId,
      reason: 'spam',
      details: null,
    })
    const [urgent] = await ctx.db.query<{ id: string; priority: string }>(
      `select id::text, priority from reports where target_id = $1 and reporter_id = $2`,
      [postId, reporter1.id],
    )
    expect(urgent?.priority).toBe('urgent')

    await resolveReport(ctx.db, admin.id, urgent!.id, 'remove_content', 'Non-consensual image')

    expect(await getPost(ctx.db, postId, null)).toBeNull()
    expect(await getPost(ctx.db, postId, { id: admin.id, role: 'admin' })).not.toBeNull()

    const open = await ctx.db.query(
      `select 1 from reports where target_id = $1 and status = 'open'`,
      [postId],
    )
    expect(open).toEqual([])

    const types = await ctx.db.query<{ recipient_id: string; type: string }>(
      `select recipient_id::text, type from notifications where actor_id = $1`,
      [admin.id],
    )
    expect(types).toEqual(
      expect.arrayContaining([
        { recipient_id: author.id, type: 'content_removed' },
        { recipient_id: reporter1.id, type: 'report_resolved' },
        { recipient_id: reporter2.id, type: 'report_resolved' },
      ]),
    )

    const log = await ctx.db.query(`select 1 from moderation_actions where target_id = $1`, [
      postId,
    ])
    expect(log.length).toBeGreaterThan(0)
  })

  it('hides a suspended account’s posts', async () => {
    const author = await createTestUser(ctx.db)
    const postId = await simplePost(author.id)
    await ctx.db.query(`update profiles set status = 'suspended' where id = $1`, [author.id])
    expect(await getPost(ctx.db, postId, null)).toBeNull()
  })
})

describe('account deletion', () => {
  it('removes the account, its content and its files, and keeps the audit trail', async () => {
    const leaver = await createTestUser(ctx.db)
    const friend = await createTestUser(ctx.db)
    const item = await wardrobePiece(leaver.id, 'kurta')
    const postId = await simplePost(leaver.id)
    const friendPost = await simplePost(friend.id)
    await addComment(ctx.db, leaver.id, friendPost, 'bye')
    await setLike(ctx.db, leaver.id, friendPost, true)
    await follow(ctx.db, friend.id, leaver.id)
    await createReport(ctx.db, leaver.id, {
      targetType: 'post',
      targetId: friendPost,
      reason: 'spam',
      details: null,
    })
    await ctx.db.query(
      `insert into user_events (user_id, event_type) values ($1, 'signin_completed')`,
      [leaver.id],
    )
    const mediaKeys = (
      await ctx.db.query<{ bucket: string; storage_key: string }>(
        'select bucket, storage_key from media where owner_id = $1',
        [leaver.id],
      )
    ).map((row) => `${row.bucket}/${row.storage_key}`)
    expect(mediaKeys.length).toBeGreaterThan(0)

    await deleteAccount(ctx.db, leaver.id)

    for (const [table, column] of [
      ['profiles', 'id'],
      ['wardrobe_items', 'user_id'],
      ['media', 'owner_id'],
      ['posts', 'author_id'],
      ['comments', 'author_id'],
      ['post_likes', 'user_id'],
      ['follows', 'followee_id'],
    ] as const) {
      const rows = await ctx.db.query(`select 1 from ${table} where ${column} = $1`, [leaver.id])
      expect({ table, rows }).toEqual({ table, rows: [] })
    }

    // Every stored file is gone.
    for (const prefix of mediaKeys) {
      expect([...store.files.keys()].some((key) => key.startsWith(prefix))).toBe(false)
    }
    expect(await ctx.db.query('select 1 from media_deletions')).toEqual([])
    expect(await getPost(ctx.db, postId, null)).toBeNull()
    expect(item.id).toBeTruthy()

    // The report survives with the reporter cleared.
    const reports = await ctx.db.query<{ reporter_id: string | null }>(
      `select reporter_id from reports where target_id = $1`,
      [friendPost],
    )
    expect(reports).toEqual([{ reporter_id: null }])

    // The friend's post is intact, with the deleted account's like and comment gone.
    const remaining = await getPost(ctx.db, friendPost, null)
    expect(remaining?.likeCount).toBe(0)
    expect(remaining?.commentCount).toBe(0)
  })
})
