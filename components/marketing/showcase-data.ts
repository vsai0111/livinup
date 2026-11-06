/**
 * The illustrative wardrobe drawn in the landing-page hero arc.
 *
 * Marketing visuals, not anyone's real wardrobe. Imagery is line art (see
 * GarmentTile), never stock photos of garments nobody owns.
 */

/** Garment shapes GarmentTile can draw. */
export type GarmentShape =
  'shirt' | 'tee' | 'knit' | 'coat' | 'trousers' | 'skirt' | 'dress' | 'shoe' | 'bag'

export interface ShowcaseItem {
  id: string
  name: string
  category: string
  /** Tile background colour. */
  tone: string
  shape: GarmentShape
}

/** The cards in the hero arc, left to right. */
export const ARC_ITEMS: readonly ShowcaseItem[] = [
  { id: 'oxford', name: 'Boxy oxford shirt', category: 'Shirts', tone: '#e8eaf0', shape: 'shirt' },
  { id: 'crew', name: 'Merino crew knit', category: 'Knitwear', tone: '#e6ddcd', shape: 'knit' },
  { id: 'chino', name: 'Relaxed chino', category: 'Trousers', tone: '#d9dcc6', shape: 'trousers' },
  { id: 'overcoat', name: 'Wool overcoat', category: 'Outerwear', tone: '#cfd2d6', shape: 'coat' },
  { id: 'midi', name: 'Pleated midi skirt', category: 'Skirts', tone: '#dcd7e2', shape: 'skirt' },
  { id: 'tee', name: 'Linen tee', category: 'Tops', tone: '#efe9df', shape: 'tee' },
  { id: 'loafer', name: 'Suede loafer', category: 'Shoes', tone: '#e3d3c0', shape: 'shoe' },
]
