'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { OCCASIONS, WARDROBE_LIMITS } from '@/config/wardrobe'
import { fail, type ActionResult } from '@/lib/actions/result'
import { runAction } from '@/lib/actions/run'
import { recordEvent } from '@/lib/analytics/events'
import { getDb } from '@/lib/db'
import { deleteOutfit, saveOutfit } from '@/lib/wardrobe/repository'
import type { Outfit } from '@/types/wardrobe'

const uuid = z.string().uuid()

const outfitSchema = z.object({
  name: z.string().trim().min(1).max(WARDROBE_LIMITS.outfitNameLength),
  occasions: z.array(z.enum(OCCASIONS)).max(10).default([]),
  notes: z
    .string()
    .trim()
    .max(WARDROBE_LIMITS.notesLength)
    .nullish()
    .transform((value) => (value ? value : null)),
  // Zone limits cap a real outfit at 13 items; 20 leaves room without allowing abuse.
  itemIds: z.array(uuid).min(1).max(20),
})

export async function saveOutfitAction(input: unknown, id?: string): Promise<ActionResult<Outfit>> {
  const parsed = outfitSchema.safeParse(input)
  if (!parsed.success) return fail('Give the outfit a name and add at least one piece.')
  if (id !== undefined && !uuid.safeParse(id).success)
    return fail('That outfit could not be found.')

  return runAction('saveOutfit', async (session) => {
    const db = await getDb()
    const outfit = await saveOutfit(
      db,
      session.id,
      { ...parsed.data, occasions: [...parsed.data.occasions] },
      id,
    )
    await recordEvent(db, {
      userId: session.id,
      eventType: 'outfit_saved',
      metadata: { items: outfit.itemIds.length, edit: Boolean(id) },
    })
    revalidatePath('/outfits')
    revalidatePath(`/outfits/${outfit.id}`)
    return outfit
  })
}

export async function deleteOutfitAction(id: string): Promise<ActionResult> {
  const parsed = uuid.safeParse(id)
  if (!parsed.success) return fail('That outfit could not be found.')

  return runAction('deleteOutfit', async (session) => {
    const db = await getDb()
    const removed = await deleteOutfit(db, session.id, parsed.data)
    if (removed) await recordEvent(db, { userId: session.id, eventType: 'outfit_deleted' })
    revalidatePath('/outfits')
    return undefined
  }) as Promise<ActionResult>
}
