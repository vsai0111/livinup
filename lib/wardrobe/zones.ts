import {
  WARDROBE_TYPES,
  ZONE_LABELS,
  ZONE_LIMITS,
  ZONES,
  wardrobeType,
  type Zone,
} from '@/config/wardrobe'

/**
 * Outfit zone rules. Pure, and shared by the builder (client) and the save
 * action (server), so the browser and the database can never disagree.
 *
 *   1. An outfit needs at least one item. No zone is required.
 *   2. In a single-item zone, adding an item replaces whatever is there. A dress
 *      (top + bottom) replaces both; adding a top replaces a dress.
 *   3. A saree occupies only the bottom zone, so saree + blouse is valid.
 *   4. Multi-item zones (layers, accessories) refuse items beyond their limit.
 */

export interface PlacedItem {
  id: string
  itemType: string
}

export function zonesOf(itemType: string): readonly Zone[] {
  return wardrobeType(itemType)?.zones ?? []
}

export type AddResult<T extends PlacedItem> =
  { ok: true; items: T[]; replaced: T[] } | { ok: false; error: string }

const PLURAL: Record<Zone, string> = {
  top: 'tops',
  bottom: 'bottoms',
  layer: 'layers',
  drape: 'drapes',
  footwear: 'pairs of footwear',
  accessory: 'accessories',
}

/** Put an item on, or take it off if it is already on. */
export function toggleItem<T extends PlacedItem>(current: readonly T[], item: T): AddResult<T> {
  if (current.some((entry) => entry.id === item.id)) {
    return { ok: true, items: current.filter((entry) => entry.id !== item.id), replaced: [] }
  }

  const zones = zonesOf(item.itemType)
  if (zones.length === 0) return { ok: false, error: 'This item has an unknown type.' }

  const singleZones = zones.filter((zone) => ZONE_LIMITS[zone] === 1)
  const replaced = current.filter((entry) =>
    zonesOf(entry.itemType).some((zone) => singleZones.includes(zone)),
  )
  const kept = current.filter((entry) => !replaced.includes(entry))

  for (const zone of zones) {
    const limit = ZONE_LIMITS[zone]
    if (limit === 1) continue
    const used = kept.filter((entry) => zonesOf(entry.itemType).includes(zone)).length
    if (used >= limit) {
      return { ok: false, error: `An outfit can have up to ${limit} ${PLURAL[zone]}.` }
    }
  }

  return { ok: true, items: [...kept, item], replaced }
}

/** Null when the combination is valid; otherwise the reason it is not. */
export function validateOutfit(items: readonly PlacedItem[]): string | null {
  if (items.length === 0) return 'Add at least one item.'
  if (new Set(items.map((item) => item.id)).size !== items.length) return 'An item is listed twice.'

  const counts = new Map<Zone, number>()
  for (const item of items) {
    const zones = zonesOf(item.itemType)
    if (zones.length === 0) return 'An item has an unknown type.'
    for (const zone of zones) counts.set(zone, (counts.get(zone) ?? 0) + 1)
  }
  for (const zone of ZONES) {
    const used = counts.get(zone) ?? 0
    if (used > ZONE_LIMITS[zone]) {
      return ZONE_LIMITS[zone] === 1
        ? `Only one item can fill the ${ZONE_LABELS[zone].toLowerCase()}.`
        : `An outfit can have up to ${ZONE_LIMITS[zone]} ${PLURAL[zone]}.`
    }
  }
  return null
}

export interface ZoneSlot<T extends PlacedItem> {
  zone: Zone
  items: T[]
  /** For a single-item zone filled by an item that lives in an earlier zone (a dress in "bottom"). */
  coveredBy: T | null
}

/** Arrange items into board slots, head to toe. */
export function arrangeByZone<T extends PlacedItem>(items: readonly T[]): ZoneSlot<T>[] {
  return ZONES.map((zone) => {
    const inZone = items.filter((item) => zonesOf(item.itemType).includes(zone))
    // An item spanning several zones is drawn once, in its first zone.
    const primary = inZone.filter((item) => zonesOf(item.itemType)[0] === zone)
    const spanning = inZone.find((item) => zonesOf(item.itemType)[0] !== zone) ?? null
    return { zone, items: primary, coveredBy: spanning }
  })
}

/** Type ids allowed in a zone, for the builder's picker. */
export function typesForZone(zone: Zone): string[] {
  return WARDROBE_TYPES.filter((entry) => entry.zones[0] === zone).map((entry) => entry.id)
}
