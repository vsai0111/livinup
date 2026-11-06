import 'server-only'
import { WARDROBE_LIMITS, wardrobeType } from '@/config/wardrobe'
import { UserFacingError } from '@/lib/actions/result'
import type { Db } from '@/lib/db/types'
import { isoDate, str, strOrNull, stringArray } from '@/lib/db/rows'
import { deleteMedia } from '@/lib/media/repository'
import type { Outfit, WardrobeItem } from '@/types/wardrobe'
import { validateOutfit } from './zones'

/**
 * Wardrobe items and outfits.
 *
 * Every statement is scoped by `user_id`; the id always comes from the
 * caller's verified session. Asking for someone else's item behaves exactly
 * like asking for one that does not exist.
 */

interface ItemRow {
  id: unknown
  name: unknown
  item_type: unknown
  color: unknown
  secondary_color: unknown
  material: unknown
  brand_text: unknown
  brand_profile_id: unknown
  notes: unknown
  media_id: unknown
  archived_at: unknown
  created_at: unknown
}

const ITEM_COLUMNS =
  'id, name, item_type, color, secondary_color, material, brand_text, brand_profile_id, ' +
  'notes, media_id, archived_at, created_at'

function toItem(row: ItemRow): WardrobeItem {
  return {
    id: str(row.id),
    name: str(row.name),
    itemType: str(row.item_type),
    color: str(row.color),
    secondaryColor: strOrNull(row.secondary_color),
    material: strOrNull(row.material),
    brandText: strOrNull(row.brand_text),
    brandProfileId: strOrNull(row.brand_profile_id),
    notes: strOrNull(row.notes),
    mediaId: strOrNull(row.media_id),
    archived: row.archived_at !== null && row.archived_at !== undefined,
    createdAt: isoDate(row.created_at),
  }
}

export async function listItems(
  db: Db,
  userId: string,
  options: { archived?: boolean } = {},
): Promise<WardrobeItem[]> {
  const rows = await db.query<ItemRow>(
    `select ${ITEM_COLUMNS} from wardrobe_items
      where user_id = $1 and (archived_at is not null) = $2
      order by created_at desc, id
      limit $3`,
    [userId, options.archived ?? false, WARDROBE_LIMITS.items],
  )
  return rows.map(toItem)
}

/** Every item, archived or not. For resolving the pieces of saved outfits. */
export async function listAllItems(db: Db, userId: string): Promise<WardrobeItem[]> {
  const rows = await db.query<ItemRow>(
    `select ${ITEM_COLUMNS} from wardrobe_items where user_id = $1
      order by created_at desc, id limit $2`,
    [userId, WARDROBE_LIMITS.items],
  )
  return rows.map(toItem)
}

export async function getItem(db: Db, userId: string, id: string): Promise<WardrobeItem | null> {
  const rows = await db.query<ItemRow>(
    `select ${ITEM_COLUMNS} from wardrobe_items where id = $1 and user_id = $2`,
    [id, userId],
  )
  return rows[0] ? toItem(rows[0]) : null
}

export async function countItems(db: Db, userId: string): Promise<number> {
  const rows = await db.query<{ n: number }>(
    'select count(*)::int as n from wardrobe_items where user_id = $1 and archived_at is null',
    [userId],
  )
  return rows[0]?.n ?? 0
}

export interface ItemInput {
  name: string
  itemType: string
  color: string
  secondaryColor: string | null
  material: string | null
  brandText: string | null
  brandProfileId: string | null
  notes: string | null
  mediaId: string | null
}

/** A media id may only be used if this user uploaded it as a wardrobe photo and nothing uses it yet. */
async function assertUsableMedia(db: Db, userId: string, mediaId: string, exceptItem?: string) {
  const rows = await db.query<{ ok: boolean }>(
    `select exists (
       select 1 from media m
        where m.id = $1 and m.owner_id = $2 and m.purpose = 'wardrobe'
          and not exists (
            select 1 from wardrobe_items w
             where w.media_id = m.id and ($3::uuid is null or w.id <> $3::uuid)
          )
     ) as ok`,
    [mediaId, userId, exceptItem ?? null],
  )
  if (!rows[0]?.ok) throw new UserFacingError('That photo could not be found. Upload it again.')
}

async function assertBrand(db: Db, brandProfileId: string) {
  const rows = await db.query<{ ok: boolean }>(
    `select exists (
       select 1 from profiles p join brand_details b on b.profile_id = p.id
        where p.id = $1 and p.account_type = 'brand' and b.verified_at is not null
     ) as ok`,
    [brandProfileId],
  )
  if (!rows[0]?.ok) throw new UserFacingError('That brand could not be found.')
}

export async function createItem(db: Db, userId: string, input: ItemInput): Promise<WardrobeItem> {
  if (!wardrobeType(input.itemType)) throw new UserFacingError('Choose a type for this piece.')
  if (input.mediaId) await assertUsableMedia(db, userId, input.mediaId)
  if (input.brandProfileId) await assertBrand(db, input.brandProfileId)

  return db.transaction(async (tx) => {
    const count = await tx.query<{ n: number }>(
      'select count(*)::int as n from wardrobe_items where user_id = $1',
      [userId],
    )
    if ((count[0]?.n ?? 0) >= WARDROBE_LIMITS.items) {
      throw new UserFacingError(
        `Your wardrobe is full (${WARDROBE_LIMITS.items} pieces). Remove something first.`,
      )
    }

    const rows = await tx.query<ItemRow>(
      `insert into wardrobe_items
         (user_id, name, item_type, color, secondary_color, material, brand_text,
          brand_profile_id, notes, media_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       returning ${ITEM_COLUMNS}`,
      [
        userId,
        input.name,
        input.itemType,
        input.color,
        input.secondaryColor,
        input.material,
        input.brandText,
        input.brandProfileId,
        input.notes,
        input.mediaId,
      ],
    )
    return toItem(rows[0])
  })
}

export async function updateItem(
  db: Db,
  userId: string,
  id: string,
  input: ItemInput,
): Promise<WardrobeItem> {
  const existing = await getItem(db, userId, id)
  if (!existing) throw new UserFacingError('That piece could not be found.')
  if (!wardrobeType(input.itemType)) throw new UserFacingError('Choose a type for this piece.')
  if (input.mediaId && input.mediaId !== existing.mediaId) {
    await assertUsableMedia(db, userId, input.mediaId, id)
  }
  if (input.brandProfileId && input.brandProfileId !== existing.brandProfileId) {
    await assertBrand(db, input.brandProfileId)
  }

  // Changing an item's type could break the zone rules of outfits it is in.
  if (input.itemType !== existing.itemType) {
    const outfits = await outfitsUsingItem(db, userId, id)
    if (outfits.length > 0) {
      const all = await listAllItems(db, userId)
      const byId = new Map(all.map((item) => [item.id, item]))
      for (const outfit of outfits) {
        const placed = outfit.itemIds
          .map((itemId) => byId.get(itemId))
          .filter((item): item is WardrobeItem => Boolean(item))
          .map((item) => ({
            id: item.id,
            itemType: item.id === id ? input.itemType : item.itemType,
          }))
        if (validateOutfit(placed)) {
          throw new UserFacingError(
            `Changing the type would break the outfit “${outfit.name}”. Remove it from that outfit first.`,
          )
        }
      }
    }
  }

  const rows = await db.query<ItemRow>(
    `update wardrobe_items
        set name = $3, item_type = $4, color = $5, secondary_color = $6, material = $7,
            brand_text = $8, brand_profile_id = $9, notes = $10, media_id = $11
      where id = $1 and user_id = $2
      returning ${ITEM_COLUMNS}`,
    [
      id,
      userId,
      input.name,
      input.itemType,
      input.color,
      input.secondaryColor,
      input.material,
      input.brandText,
      input.brandProfileId,
      input.notes,
      input.mediaId,
    ],
  )

  // A replaced photo is deleted, not left behind.
  if (existing.mediaId && existing.mediaId !== input.mediaId) {
    await deleteMedia(db, [existing.mediaId], userId)
  }
  return toItem(rows[0])
}

export async function setArchived(
  db: Db,
  userId: string,
  id: string,
  archived: boolean,
): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    `update wardrobe_items set archived_at = case when $3 then coalesce(archived_at, now()) else null end
      where id = $1 and user_id = $2 returning id`,
    [id, userId, archived],
  )
  return rows.length > 0
}

/**
 * Delete an item. It leaves every outfit it was in; outfits left with no items
 * are deleted too. Published posts are copies and are not affected.
 */
export async function deleteItem(db: Db, userId: string, id: string): Promise<boolean> {
  const mediaId = await db.transaction(async (tx) => {
    const removed = await tx.query<{ media_id: string | null }>(
      'delete from wardrobe_items where id = $1 and user_id = $2 returning media_id',
      [id, userId],
    )
    if (removed.length === 0) return undefined
    await tx.query(
      `delete from outfits o
        where o.user_id = $1
          and not exists (select 1 from outfit_items oi where oi.outfit_id = o.id)`,
      [userId],
    )
    return removed[0].media_id ?? null
  })

  if (mediaId === undefined) return false
  if (mediaId) await deleteMedia(db, [mediaId], userId)
  return true
}

/* ------------------------------------------------------------------ outfits -- */

interface OutfitRow {
  id: unknown
  name: unknown
  occasions: unknown
  notes: unknown
  item_ids: unknown
  created_at: unknown
  updated_at: unknown
}

function toOutfit(row: OutfitRow): Outfit {
  return {
    id: str(row.id),
    name: str(row.name),
    occasions: stringArray(row.occasions),
    notes: strOrNull(row.notes),
    itemIds: stringArray(row.item_ids),
    createdAt: isoDate(row.created_at),
    updatedAt: isoDate(row.updated_at),
  }
}

const OUTFIT_SELECT = `
  select o.id, o.name, o.occasions, o.notes, o.created_at, o.updated_at,
         coalesce(
           (select array_agg(oi.item_id::text order by oi.position, oi.item_id)
              from outfit_items oi where oi.outfit_id = o.id),
           '{}'
         ) as item_ids
    from outfits o`

export async function listOutfits(
  db: Db,
  userId: string,
  options: { occasion?: string } = {},
): Promise<Outfit[]> {
  const rows = await db.query<OutfitRow>(
    `${OUTFIT_SELECT}
      where o.user_id = $1 and ($2::text is null or $2 = any(o.occasions))
      order by o.updated_at desc, o.id
      limit $3`,
    [userId, options.occasion ?? null, WARDROBE_LIMITS.outfits],
  )
  return rows.map(toOutfit)
}

export async function getOutfit(db: Db, userId: string, id: string): Promise<Outfit | null> {
  const rows = await db.query<OutfitRow>(`${OUTFIT_SELECT} where o.id = $1 and o.user_id = $2`, [
    id,
    userId,
  ])
  return rows[0] ? toOutfit(rows[0]) : null
}

export async function outfitsUsingItem(db: Db, userId: string, itemId: string): Promise<Outfit[]> {
  const rows = await db.query<OutfitRow>(
    `${OUTFIT_SELECT}
      where o.user_id = $1
        and exists (select 1 from outfit_items x where x.outfit_id = o.id and x.item_id = $2)
      order by o.updated_at desc`,
    [userId, itemId],
  )
  return rows.map(toOutfit)
}

export interface OutfitInput {
  name: string
  occasions: string[]
  notes: string | null
  itemIds: string[]
}

/**
 * Create (no `id`) or update an outfit.
 *
 * Checks on the server, whatever the browser sent: every item belongs to this
 * user; archived items may stay in an outfit that already had them but cannot
 * be newly added; and the zone rules hold.
 */
export async function saveOutfit(
  db: Db,
  userId: string,
  input: OutfitInput,
  id?: string,
): Promise<Outfit> {
  const existing = id ? await getOutfit(db, userId, id) : null
  if (id && !existing) throw new UserFacingError('That outfit could not be found.')

  const owned = await db.query<{ id: string; item_type: string; archived: boolean }>(
    `select id::text as id, item_type, archived_at is not null as archived
       from wardrobe_items where user_id = $1 and id = any($2::uuid[])`,
    [userId, input.itemIds],
  )
  if (owned.length !== new Set(input.itemIds).size) {
    throw new UserFacingError('One of those pieces is no longer in your wardrobe.')
  }
  const previous = new Set(existing?.itemIds ?? [])
  if (owned.some((item) => item.archived && !previous.has(item.id))) {
    throw new UserFacingError('Archived pieces cannot be added to an outfit.')
  }

  const byId = new Map(owned.map((item) => [item.id, item]))
  const problem = validateOutfit(
    input.itemIds.map((itemId) => ({ id: itemId, itemType: byId.get(itemId)!.item_type })),
  )
  if (problem) throw new UserFacingError(problem)

  const outfitId = await db.transaction(async (tx) => {
    let target = id
    if (!target) {
      const count = await tx.query<{ n: number }>(
        'select count(*)::int as n from outfits where user_id = $1',
        [userId],
      )
      if ((count[0]?.n ?? 0) >= WARDROBE_LIMITS.outfits) {
        throw new UserFacingError(
          `You have saved the maximum of ${WARDROBE_LIMITS.outfits} outfits. Delete one first.`,
        )
      }
      const created = await tx.query<{ id: string }>(
        `insert into outfits (user_id, name, occasions, notes) values ($1, $2, $3, $4) returning id`,
        [userId, input.name, input.occasions, input.notes],
      )
      target = created[0].id
    } else {
      await tx.query(
        `update outfits set name = $3, occasions = $4, notes = $5, updated_at = now()
          where id = $1 and user_id = $2`,
        [target, userId, input.name, input.occasions, input.notes],
      )
      await tx.query('delete from outfit_items where outfit_id = $1', [target])
    }

    for (const [position, itemId] of input.itemIds.entries()) {
      await tx.query(
        'insert into outfit_items (outfit_id, item_id, position) values ($1, $2, $3)',
        [target, itemId, position],
      )
    }
    return target
  })

  return (await getOutfit(db, userId, outfitId))!
}

export async function deleteOutfit(db: Db, userId: string, id: string): Promise<boolean> {
  const rows = await db.query<{ id: string }>(
    'delete from outfits where id = $1 and user_id = $2 returning id',
    [id, userId],
  )
  return rows.length > 0
}
