/** A piece of clothing the user owns. Private to its owner. */
export interface WardrobeItem {
  id: string
  name: string
  itemType: string
  color: string
  secondaryColor: string | null
  material: string | null
  brandText: string | null
  brandProfileId: string | null
  notes: string | null
  mediaId: string | null
  archived: boolean
  createdAt: string
}

/** A saved look built from wardrobe items. */
export interface Outfit {
  id: string
  name: string
  occasions: string[]
  notes: string | null
  /** In the order they were placed. */
  itemIds: string[]
  createdAt: string
  updatedAt: string
}
