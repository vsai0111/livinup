/**
 * Illustrative data for the landing-page product mockups.
 *
 * These are marketing visuals — the equivalent of a product screenshot — not a
 * live view of anyone's wardrobe. They are kept here, apart from the
 * components, so it is obvious at a glance that the landing page invents
 * nothing beyond them.
 *
 * Three rules govern what may appear below:
 *
 *   1. Nothing here is presented as a real person, a real brand, a real
 *      stylist, a customer, a rating or a testimonial. Brand and stylist cards
 *      carry a visible "illustration" label in the components that render them,
 *      because those parts of the product are planned rather than built.
 *   2. Garment attributes come from the controlled vocabulary the application
 *      already uses — `boxy`, `relaxed`, `minimal` are real values, not
 *      invented ones.
 *   3. Imagery is drawn, not photographed. Wardrobe items render as line-art
 *      silhouettes (see GarmentTile) rather than stock photos of garments
 *      nobody owns.
 */

/** Garment shapes GarmentTile can draw. */
export type GarmentShape =
  'shirt' | 'tee' | 'knit' | 'coat' | 'trousers' | 'skirt' | 'dress' | 'shoe' | 'bag'

export interface WardrobeItem {
  id: string
  name: string
  category: string
  /** Swatch colour for the tile ground. Illustrative, not a catalogue value. */
  tone: string
  shape: GarmentShape
  attributes: readonly string[]
}

/** The digital closet shown in the wardrobe section. */
export const WARDROBE_ITEMS: readonly WardrobeItem[] = [
  {
    id: 'oxford',
    name: 'Boxy oxford shirt',
    category: 'Shirts',
    tone: '#e8eaf0',
    shape: 'shirt',
    attributes: ['boxy', 'cotton', 'white'],
  },
  {
    id: 'crew',
    name: 'Merino crew knit',
    category: 'Knitwear',
    tone: '#e6ddcd',
    shape: 'knit',
    attributes: ['relaxed', 'merino', 'oatmeal'],
  },
  {
    id: 'chino',
    name: 'Relaxed chino',
    category: 'Trousers',
    tone: '#d9dcc6',
    shape: 'trousers',
    attributes: ['relaxed', 'cotton', 'olive'],
  },
  {
    id: 'overcoat',
    name: 'Wool overcoat',
    category: 'Outerwear',
    tone: '#cfd2d6',
    shape: 'coat',
    attributes: ['tailored', 'wool', 'charcoal'],
  },
  {
    id: 'midi',
    name: 'Pleated midi skirt',
    category: 'Skirts',
    tone: '#dcd7e2',
    shape: 'skirt',
    attributes: ['fluid', 'twill', 'ink'],
  },
  {
    id: 'tee',
    name: 'Linen tee',
    category: 'Tops',
    tone: '#efe9df',
    shape: 'tee',
    attributes: ['boxy', 'linen', 'ecru'],
  },
  {
    id: 'loafer',
    name: 'Suede loafer',
    category: 'Shoes',
    tone: '#e3d3c0',
    shape: 'shoe',
    attributes: ['classic', 'suede', 'tan'],
  },
  {
    id: 'tote',
    name: 'Canvas tote',
    category: 'Bags',
    tone: '#e7e2d6',
    shape: 'bag',
    attributes: ['everyday', 'canvas', 'natural'],
  },
  {
    id: 'slip',
    name: 'Silk slip dress',
    category: 'Dresses',
    tone: '#dfe3e6',
    shape: 'dress',
    attributes: ['fluid', 'silk', 'slate'],
  },
  {
    id: 'denim',
    name: 'Straight denim',
    category: 'Trousers',
    tone: '#d3d9e4',
    shape: 'trousers',
    attributes: ['straight', 'denim', 'indigo'],
  },
]

/** Categories listed down the side of the wardrobe mockup. */
export const WARDROBE_CATEGORIES = [
  { label: 'All items', active: true },
  { label: 'Tops' },
  { label: 'Knitwear' },
  { label: 'Trousers' },
  { label: 'Dresses' },
  { label: 'Outerwear' },
  { label: 'Shoes' },
  { label: 'Bags' },
] as const

/** Occasions offered in the styling mockup. */
export const OCCASIONS = ['Work', 'Dinner', 'Weekend', 'Travel', 'Event'] as const

export interface Outfit {
  id: string
  occasion: string
  title: string
  /** Wardrobe item ids this look is built from. */
  items: readonly string[]
  /** Plain-language reason, the way the product would phrase one. */
  why: string
  tags: readonly string[]
}

/** Looks assembled from items already in the wardrobe above. */
export const OUTFITS: readonly Outfit[] = [
  {
    id: 'o-1',
    occasion: 'Work',
    title: 'Quiet tailoring',
    items: ['oxford', 'chino', 'loafer', 'overcoat'],
    why: 'A boxy shirt softens the tailored coat, and the olive picks up the tan in the loafer.',
    tags: ['Minimal', 'Layered', 'Neutral'],
  },
  {
    id: 'o-2',
    occasion: 'Dinner',
    title: 'Slip and knit',
    items: ['slip', 'crew', 'loafer'],
    why: 'Knitwear over a slip keeps the line fluid while covering the shoulder.',
    tags: ['Fluid', 'Tonal'],
  },
  {
    id: 'o-3',
    occasion: 'Weekend',
    title: 'Ecru and indigo',
    items: ['tee', 'denim', 'tote'],
    why: 'Two easy shapes, one warm neutral against one cool — nothing competes.',
    tags: ['Relaxed', 'Everyday'],
  },
]

/**
 * Gap suggestions. Described as pieces from participating brands rather than a
 * universal catalogue, because that is what the product intends to be.
 */
export const GAP_SUGGESTIONS = [
  {
    id: 'g-1',
    name: 'Fine-gauge roll neck',
    shape: 'knit' as GarmentShape,
    tone: '#dcdfe3',
    role: 'Carries the coat into winter',
  },
  {
    id: 'g-2',
    name: 'Woven leather belt, tan',
    shape: 'bag' as GarmentShape,
    tone: '#e0cdb6',
    role: 'Ties the loafer to the chino',
  },
  {
    id: 'g-3',
    name: 'Pointed flat, black',
    shape: 'shoe' as GarmentShape,
    tone: '#d6d6da',
    role: 'The one evening shoe missing',
  },
] as const

/**
 * Brand discovery. The names are deliberately generic placeholders and every
 * card is labelled as an illustration where it is rendered — no real label is
 * represented here, and no figure below describes a real business.
 */
export const BRAND_CARDS = [
  {
    id: 'b-1',
    name: 'Knitwear studio',
    discipline: 'Slow-made merino, six pieces a season',
    note: 'New collection',
    tone: '#e3ddd2',
    shape: 'knit' as GarmentShape,
    palette: ['#e3ddd2', '#c3b7a3', '#8a8071', '#5e5950'],
  },
  {
    id: 'b-2',
    name: 'Tailoring atelier',
    discipline: 'Made to order, two fittings',
    note: 'Lookbook',
    tone: '#d8dce2',
    shape: 'coat' as GarmentShape,
    palette: ['#d8dce2', '#a9b0bb', '#5e6673', '#2b2f36'],
  },
  {
    id: 'b-3',
    name: 'Everyday linen label',
    discipline: 'One fabric, eight shapes',
    note: 'Just launched',
    tone: '#e9e2d6',
    shape: 'tee' as GarmentShape,
    palette: ['#e9e2d6', '#d6c7ae', '#b7a98f', '#7d7363'],
  },
  {
    id: 'b-4',
    name: 'Leather workshop',
    discipline: 'Hand-finished, repairable',
    note: 'Back in stock',
    tone: '#e2d2bd',
    shape: 'shoe' as GarmentShape,
    palette: ['#e2d2bd', '#c9a97f', '#9b7748', '#5c452a'],
  },
] as const

/**
 * Stylist marketplace. Specialisations only: no names, no ratings, no
 * consultation counts and no reviews, because no stylist has yet joined and
 * inventing one would be a lie told at the moment a visitor is deciding
 * whether to trust the product.
 */
export const STYLIST_SPECIALISMS = [
  { id: 's-1', focus: 'Minimal tailoring', mode: 'Video consultation', scope: 'Capsule building' },
  { id: 's-2', focus: 'Colour and contrast', mode: 'Chat styling', scope: 'Wardrobe audit' },
  { id: 's-3', focus: 'Occasion dressing', mode: 'Video consultation', scope: 'Event looks' },
] as const

/** The five steps of the closing narrative. */
export const JOURNEY = [
  ['Your wardrobe', 'Photograph what you own. It becomes a closet you can browse.'],
  ['AI styling', 'Outfits built from those pieces, for the occasion you pick.'],
  ['Recommendations', 'The gaps worth filling, in the colours you actually wear.'],
  ['Brands', 'Labels and launches that match the way you already dress.'],
  ['Shopping', 'Buy the piece, or wear the look you already own. Both are a win.'],
] as const
