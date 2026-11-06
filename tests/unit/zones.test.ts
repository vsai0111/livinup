import { describe, expect, it } from 'vitest'
import { arrangeByZone, toggleItem, validateOutfit, zonesOf } from '@/lib/wardrobe/zones'
import { WARDROBE_TYPES, ZONES } from '@/config/wardrobe'

/**
 * Outfit zone rules (docs/product-spec.md 5.3). These are what stop the board
 * assuming every outfit is "a top and a bottom".
 */

let next = 0
const piece = (itemType: string) => ({ id: `item-${++next}`, itemType })

function wear(...types: string[]) {
  let items: ReturnType<typeof piece>[] = []
  for (const type of types) {
    const result = toggleItem(items, piece(type))
    if (!result.ok) throw new Error(result.error)
    items = result.items
  }
  return items
}

describe('wardrobe vocabulary', () => {
  it('gives every type at least one known zone', () => {
    for (const entry of WARDROBE_TYPES) {
      expect(entry.zones.length).toBeGreaterThan(0)
      for (const zone of entry.zones) expect(ZONES).toContain(zone)
    }
  })

  it('has unique type ids', () => {
    const ids = WARDROBE_TYPES.map((entry) => entry.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('toggleItem', () => {
  it('lets a saree be worn with a blouse', () => {
    const items = wear('saree', 'blouse')
    expect(items.map((item) => item.itemType)).toEqual(['saree', 'blouse'])
    expect(validateOutfit(items)).toBeNull()
  })

  it('makes a dress replace both the top and the bottom', () => {
    const top = piece('shirt')
    const bottom = piece('jeans')
    const dress = piece('dress')
    const result = toggleItem([top, bottom], dress)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.items).toEqual([dress])
      expect(result.replaced).toEqual([top, bottom])
    }
  })

  it('makes a top replace a dress', () => {
    const items = wear('anarkali', 'kurta')
    expect(items.map((item) => item.itemType)).toEqual(['kurta'])
  })

  it('swaps the piece in a single-item zone', () => {
    const items = wear('sneakers', 'juttis')
    expect(items.map((item) => item.itemType)).toEqual(['juttis'])
  })

  it('allows two layers, then refuses a third', () => {
    const items = wear('nehru-jacket', 'stole', 'blazer')
    const result = toggleItem(items, piece('coat'))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/up to 2 layers/)
  })

  it('takes an item off when it is toggled again', () => {
    const kurta = piece('kurta')
    const on = toggleItem([], kurta)
    if (!on.ok) throw new Error('setup')
    const off = toggleItem(on.items, kurta)
    expect(off.ok && off.items).toEqual([])
  })

  it('refuses an unknown type', () => {
    expect(toggleItem([], piece('spacesuit')).ok).toBe(false)
  })

  it('builds a full sherwani look without conflicts', () => {
    const items = wear('kurta', 'salwar', 'sherwani', 'stole', 'juttis', 'watch')
    expect(items).toHaveLength(6)
    expect(validateOutfit(items)).toBeNull()
  })
})

describe('validateOutfit', () => {
  it('requires at least one item, but no particular zone', () => {
    expect(validateOutfit([])).toMatch(/at least one/)
    expect(validateOutfit([piece('watch')])).toBeNull()
  })

  it('rejects a combination the builder would never produce', () => {
    // Server-side: the request may not have come from the builder.
    expect(validateOutfit([piece('dress'), piece('jeans')])).toMatch(/Only one item/)
    expect(validateOutfit([piece('shirt'), piece('kurta')])).toMatch(/Only one item/)
  })

  it('rejects the same item twice', () => {
    const item = piece('kurta')
    expect(validateOutfit([item, item])).toMatch(/twice/)
  })
})

describe('arrangeByZone', () => {
  it('draws a dress once, in the top slot, and marks the bottom as covered', () => {
    const dress = piece('dress')
    const slots = arrangeByZone([dress])
    const top = slots.find((slot) => slot.zone === 'top')!
    const bottom = slots.find((slot) => slot.zone === 'bottom')!
    expect(top.items).toEqual([dress])
    expect(bottom.items).toEqual([])
    expect(bottom.coveredBy).toEqual(dress)
  })

  it('places a saree in the bottom slot, leaving the top free', () => {
    expect(zonesOf('saree')).toEqual(['bottom'])
    const slots = arrangeByZone([piece('saree')])
    expect(slots.find((slot) => slot.zone === 'top')!.items).toEqual([])
    expect(slots.find((slot) => slot.zone === 'bottom')!.items).toHaveLength(1)
  })
})
