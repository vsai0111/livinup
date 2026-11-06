'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import {
  COLORS,
  MATERIALS,
  WARDROBE_LIMITS,
  WARDROBE_TYPE_IDS,
  wardrobeType,
} from '@/config/wardrobe'
import { fail, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { recordEvent } from '@/lib/analytics/events'
import { getDb } from '@/lib/db'
import { humanize } from '@/lib/utils/format'
import {
  createItem,
  deleteItem,
  setArchived,
  updateItem,
  type ItemInput,
} from '@/lib/wardrobe/repository'
import type { WardrobeItem } from '@/types/wardrobe'

/**
 * Wardrobe Server Actions. The user comes only from the session (runAction);
 * every field is validated here and ownership is checked again in the
 * repository.
 */

const uuid = z.string().uuid()

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null))

const itemSchema = z.object({
  name: optionalText(WARDROBE_LIMITS.nameLength),
  itemType: z.enum(WARDROBE_TYPE_IDS),
  color: z.enum(COLORS),
  secondaryColor: z
    .enum(COLORS)
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || null),
  material: z
    .enum(MATERIALS)
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || null),
  brandText: optionalText(WARDROBE_LIMITS.brandLength),
  brandProfileId: uuid
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || null),
  notes: optionalText(WARDROBE_LIMITS.notesLength),
  mediaId: uuid
    .nullish()
    .or(z.literal(''))
    .transform((v) => v || null),
})

function toInput(parsed: z.infer<typeof itemSchema>): ItemInput {
  const type = wardrobeType(parsed.itemType)
  return {
    ...parsed,
    // A sensible default: "Olive kurta".
    name: parsed.name ?? `${humanize(parsed.color)} ${(type?.label ?? 'piece').toLowerCase()}`,
  }
}

export async function createItemAction(input: unknown): Promise<ActionResult<WardrobeItem>> {
  const parsed = itemSchema.safeParse(input)
  if (!parsed.success) return fail('Choose a type and a colour for this piece.')

  return runAction('createItem', async (session) => {
    const db = await getDb()
    const item = await createItem(db, session.id, toInput(parsed.data))
    await recordEvent(db, {
      userId: session.id,
      eventType: 'item_added',
      metadata: { itemType: item.itemType, hasPhoto: Boolean(item.mediaId) },
    })
    revalidatePath('/wardrobe')
    return item
  })
}

export async function updateItemAction(
  id: string,
  input: unknown,
): Promise<ActionResult<WardrobeItem>> {
  const parsedId = uuid.safeParse(id)
  const parsed = itemSchema.safeParse(input)
  if (!parsedId.success || !parsed.success) return fail('Check the details and try again.')

  return runAction('updateItem', async (session) => {
    const db = await getDb()
    const item = await updateItem(db, session.id, parsedId.data, toInput(parsed.data))
    await recordEvent(db, { userId: session.id, eventType: 'item_updated' })
    revalidatePath('/wardrobe')
    revalidatePath(`/wardrobe/${item.id}`)
    revalidatePath('/outfits')
    return item
  })
}

export async function setArchivedAction(id: string, archived: boolean): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return fail('That piece could not be found.')

  return runAction('archiveItem', async (session) => {
    const db = await getDb()
    const changed = await setArchived(db, session.id, parsed.data, archived)
    if (!changed) throw new Error('item not found for owner')
    if (archived) await recordEvent(db, { userId: session.id, eventType: 'item_archived' })
    revalidatePath('/wardrobe')
    revalidatePath(`/wardrobe/${parsed.data}`)
    return undefined
  }) as Promise<ActionResult>
}

export async function deleteItemAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return fail('That piece could not be found.')

  return runAction('deleteItem', async (session) => {
    const db = await getDb()
    const removed = await deleteItem(db, session.id, parsed.data)
    if (removed) await recordEvent(db, { userId: session.id, eventType: 'item_deleted' })
    revalidatePath('/wardrobe')
    revalidatePath('/outfits')
    return undefined
  }) as Promise<ActionResult>
}
