import 'server-only'
import { randomUUID } from 'node:crypto'
import type { Db } from '@/lib/db/types'
import { isoDate, num, str } from '@/lib/db/rows'
import { logger } from '@/lib/logging/logger'
import { MEDIA_SIZES, processImage, type MediaSize } from './process'
import { getImageStore, type Bucket, type ImageStore } from './store'

/**
 * Media rows and their stored files.
 *
 * Every file deletion goes through `media_deletions` first, so a storage
 * failure is retried later instead of leaving an orphaned file nobody knows
 * about. That queue has no foreign key to profiles, so it survives account
 * deletion.
 */

export type MediaPurpose = 'wardrobe' | 'post' | 'avatar'

export interface MediaRecord {
  id: string
  ownerId: string
  purpose: MediaPurpose
  bucket: Bucket
  storageKey: string
  width: number
  height: number
  createdAt: string
}

const COLUMNS = 'id, owner_id, purpose, bucket, storage_key, width, height, created_at'

interface MediaRow {
  id: unknown
  owner_id: unknown
  purpose: unknown
  bucket: unknown
  storage_key: unknown
  width: unknown
  height: unknown
  created_at: unknown
}

function toRecord(row: MediaRow): MediaRecord {
  return {
    id: str(row.id),
    ownerId: str(row.owner_id),
    purpose: str(row.purpose) as MediaPurpose,
    bucket: str(row.bucket) as Bucket,
    storageKey: str(row.storage_key),
    width: num(row.width),
    height: num(row.height),
    createdAt: isoDate(row.created_at),
  }
}

export function variantKey(storageKey: string, size: MediaSize): string {
  return `${storageKey}/${size}.webp`
}

const ALL_SIZES = Object.keys(MEDIA_SIZES) as MediaSize[]

function bucketFor(purpose: MediaPurpose): Bucket {
  return purpose === 'wardrobe' ? 'wardrobe' : 'public-content'
}

/** Process an upload and store it. Returns the new media record. */
export async function storeUpload(
  db: Db,
  ownerId: string,
  purpose: MediaPurpose,
  input: Buffer,
  store?: ImageStore,
): Promise<MediaRecord> {
  const processed = await processImage(input, { keepLarge: purpose === 'wardrobe' })
  const bucket = bucketFor(purpose)
  const storageKey = `${ownerId}/${randomUUID()}`
  const target = store ?? (await getImageStore())

  for (const [size, body] of Object.entries(processed.variants) as Array<[MediaSize, Buffer]>) {
    await target.put(bucket, variantKey(storageKey, size), body, 'image/webp')
  }

  try {
    const rows = await db.query<MediaRow>(
      `insert into media (owner_id, purpose, bucket, storage_key, width, height, bytes, sha256)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning ${COLUMNS}`,
      [
        ownerId,
        purpose,
        bucket,
        storageKey,
        processed.width,
        processed.height,
        processed.bytes,
        processed.sha256,
      ],
    )
    return toRecord(rows[0])
  } catch (error) {
    // The row failed, so nothing references these files: remove them now.
    await target
      .remove(
        bucket,
        ALL_SIZES.map((size) => variantKey(storageKey, size)),
      )
      .catch(() => {})
    throw error
  }
}

/**
 * Copy an owner's media into the public-content bucket, for publishing.
 *
 * A post must never point at a wardrobe file: the copy is what makes the post
 * a snapshot, and what lets the wardrobe stay private.
 */
export async function copyForPublishing(
  db: Db,
  ownerId: string,
  sourceId: string,
  store?: ImageStore,
): Promise<MediaRecord> {
  const source = await getMedia(db, sourceId)
  if (!source || source.ownerId !== ownerId) throw new Error('media not found')

  const target = store ?? (await getImageStore())
  const storageKey = `${ownerId}/${randomUUID()}`
  const copied: MediaSize[] = []

  for (const size of ['sm', 'md'] as const) {
    const body = await target.get(source.bucket, variantKey(source.storageKey, size))
    if (!body) throw new Error('source image is missing from storage')
    await target.put('public-content', variantKey(storageKey, size), body, 'image/webp')
    copied.push(size)
  }

  const rows = await db.query<MediaRow>(
    `insert into media (owner_id, purpose, bucket, storage_key, width, height, bytes, sha256)
     select owner_id, 'post', 'public-content', $3,
            least(width, ${MEDIA_SIZES.md}), least(height, ${MEDIA_SIZES.md}), bytes, sha256
       from media where id = $1 and owner_id = $2
     returning ${COLUMNS}`,
    [sourceId, ownerId, storageKey],
  )
  if (!rows[0]) {
    await target.remove(
      'public-content',
      copied.map((size) => variantKey(storageKey, size)),
    )
    throw new Error('media not found')
  }
  return toRecord(rows[0])
}

export async function getMedia(db: Db, id: string): Promise<MediaRecord | null> {
  const rows = await db.query<MediaRow>(`select ${COLUMNS} from media where id = $1`, [id])
  return rows[0] ? toRecord(rows[0]) : null
}

/**
 * Delete media rows and queue their files for removal, then try to remove the
 * files straight away. Scoped by owner unless `ownerId` is null (admin and
 * cleanup paths).
 */
export async function deleteMedia(
  db: Db,
  ids: readonly string[],
  ownerId: string | null,
): Promise<void> {
  if (ids.length === 0) return
  const removed = await db.transaction(async (tx) => {
    const rows = await tx.query<{ bucket: string; storage_key: string }>(
      `delete from media
        where id = any($1::uuid[]) and ($2::uuid is null or owner_id = $2)
        returning bucket, storage_key`,
      [ids, ownerId],
    )
    await enqueueDeletions(tx, rows)
    return rows
  })
  if (removed.length > 0)
    await processDeletionQueue(db, { keys: removed.map((r) => r.storage_key) })
}

/** Queue stored files for removal. Idempotent. */
export async function enqueueDeletions(
  db: Db,
  rows: ReadonlyArray<{ bucket: string; storage_key: string }>,
): Promise<void> {
  for (const row of rows) {
    await db.query(
      `insert into media_deletions (bucket, storage_key) values ($1, $2)
       on conflict (bucket, storage_key) do nothing`,
      [row.bucket, row.storage_key],
    )
  }
}

/**
 * Remove queued files from storage. Failures stay queued with an attempt
 * count; the scheduled cleanup retries them.
 */
export async function processDeletionQueue(
  db: Db,
  options: { limit?: number; keys?: readonly string[]; store?: ImageStore } = {},
): Promise<{ removed: number; failed: number }> {
  const rows = await db.query<{ id: string; bucket: string; storage_key: string }>(
    `select id, bucket, storage_key from media_deletions
      where ($2::text[] is null or storage_key = any($2::text[]))
      order by created_at
      limit $1`,
    [options.limit ?? 200, options.keys ?? null],
  )
  if (rows.length === 0) return { removed: 0, failed: 0 }

  let store: ImageStore
  try {
    store = options.store ?? (await getImageStore())
  } catch (error) {
    logger.warn('media deletion deferred: no image store', { error })
    return { removed: 0, failed: rows.length }
  }

  let removed = 0
  let failed = 0
  for (const row of rows) {
    try {
      await store.remove(
        row.bucket as Bucket,
        ALL_SIZES.map((size) => variantKey(row.storage_key, size)),
      )
      await db.query('delete from media_deletions where id = $1', [row.id])
      removed++
    } catch (error) {
      failed++
      await db.query(
        `update media_deletions set attempts = attempts + 1, last_error = $2 where id = $1`,
        [row.id, error instanceof Error ? error.name : 'unknown'],
      )
    }
  }
  return { removed, failed }
}

/**
 * Media rows that nothing references, older than the grace period. Uploads
 * that were never attached (an abandoned "add pieces" or post draft) end here.
 */
export async function deleteOrphanedMedia(db: Db, olderThanHours = 24): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `select m.id from media m
      where m.created_at < now() - ($1::int * interval '1 hour')
        and not exists (select 1 from wardrobe_items w where w.media_id = m.id)
        and not exists (select 1 from post_images p where p.media_id = m.id)
        and not exists (select 1 from profiles pr where pr.avatar_media_id = m.id)
      limit 500`,
    [olderThanHours],
  )
  await deleteMedia(
    db,
    rows.map((row) => row.id),
    null,
  )
  return rows.length
}
