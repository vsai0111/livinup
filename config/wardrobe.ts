/**
 * Wardrobe vocabulary and outfit zones.
 *
 * Every clothing type declares which outfit *zones* it occupies. Outfit rules
 * follow from that, so nothing assumes an outfit is "a top plus a bottom":
 *
 *   - A dress occupies top + bottom, so it replaces both.
 *   - A saree occupies only the bottom zone, leaving the top for its blouse.
 *   - Layers, drapes and accessories have their own zones and limits.
 *
 * See docs/product-spec.md 5.3. Adding a type is safe; renaming or removing one
 * needs a data migration, because `wardrobe_items.item_type` stores the id.
 */

export const ZONES = ['top', 'bottom', 'layer', 'drape', 'footwear', 'accessory'] as const
export type Zone = (typeof ZONES)[number]

/** How many items one outfit may hold in each zone. */
export const ZONE_LIMITS: Record<Zone, number> = {
  top: 1,
  bottom: 1,
  layer: 2,
  drape: 1,
  footwear: 1,
  accessory: 6,
}

export const ZONE_LABELS: Record<Zone, string> = {
  top: 'Top',
  bottom: 'Bottom',
  layer: 'Layer',
  drape: 'Drape',
  footwear: 'Footwear',
  accessory: 'Accessories',
}

/** Wardrobe tabs. A grouping for browsing, separate from outfit zones. */
export const ITEM_GROUPS = [
  'top',
  'bottom',
  'full',
  'layer',
  'drape',
  'footwear',
  'accessory',
] as const
export type ItemGroup = (typeof ITEM_GROUPS)[number]

export const GROUP_LABELS: Record<ItemGroup, string> = {
  top: 'Tops',
  bottom: 'Bottoms',
  full: 'Dresses & sets',
  layer: 'Layers',
  drape: 'Dupattas & stoles',
  footwear: 'Footwear',
  accessory: 'Accessories',
}

/** Drawing used for an item that has no photo. */
export type GarmentShape =
  | 'tee'
  | 'shirt'
  | 'kurta'
  | 'knit'
  | 'trousers'
  | 'jeans'
  | 'shorts'
  | 'skirt'
  | 'dress'
  | 'saree'
  | 'jacket'
  | 'coat'
  | 'sneaker'
  | 'boot'
  | 'sandal'
  | 'formal-shoe'
  | 'bag'
  | 'belt'
  | 'watch'
  | 'sunglasses'
  | 'scarf'
  | 'jewellery'

export interface WardrobeType {
  id: string
  label: string
  group: ItemGroup
  zones: readonly Zone[]
  shape: GarmentShape
}

function type(
  id: string,
  label: string,
  group: ItemGroup,
  zones: readonly Zone[],
  shape: GarmentShape,
): WardrobeType {
  return { id, label, group, zones, shape }
}

export const WARDROBE_TYPES: readonly WardrobeType[] = [
  type('t-shirt', 'T-shirt', 'top', ['top'], 'tee'),
  type('shirt', 'Shirt', 'top', ['top'], 'shirt'),
  type('kurta', 'Kurta', 'top', ['top'], 'kurta'),
  type('blouse', 'Blouse / choli', 'top', ['top'], 'tee'),
  type('sweater', 'Sweater', 'top', ['top'], 'knit'),
  type('activewear-top', 'Activewear top', 'top', ['top'], 'tee'),

  type('trousers', 'Trousers', 'bottom', ['bottom'], 'trousers'),
  type('jeans', 'Jeans', 'bottom', ['bottom'], 'jeans'),
  type('shorts', 'Shorts', 'bottom', ['bottom'], 'shorts'),
  type('skirt', 'Skirt', 'bottom', ['bottom'], 'skirt'),
  type('salwar', 'Salwar / churidar', 'bottom', ['bottom'], 'trousers'),
  type('palazzo', 'Palazzo', 'bottom', ['bottom'], 'trousers'),
  type('lehenga-skirt', 'Lehenga skirt', 'bottom', ['bottom'], 'skirt'),

  type('dress', 'Dress', 'full', ['top', 'bottom'], 'dress'),
  type('jumpsuit', 'Jumpsuit', 'full', ['top', 'bottom'], 'dress'),
  type('anarkali', 'Anarkali', 'full', ['top', 'bottom'], 'dress'),
  type('suit-set', 'Salwar suit set', 'full', ['top', 'bottom'], 'kurta'),
  type('lehenga-set', 'Lehenga set', 'full', ['top', 'bottom'], 'skirt'),
  // A saree is draped over the lower body and worn with a separate blouse.
  type('saree', 'Saree', 'full', ['bottom'], 'saree'),

  type('jacket', 'Jacket', 'layer', ['layer'], 'jacket'),
  type('blazer', 'Blazer', 'layer', ['layer'], 'jacket'),
  type('coat', 'Coat', 'layer', ['layer'], 'coat'),
  type('nehru-jacket', 'Nehru jacket', 'layer', ['layer'], 'jacket'),
  type('sherwani', 'Sherwani', 'layer', ['layer'], 'coat'),
  type('shrug', 'Shrug', 'layer', ['layer'], 'jacket'),

  type('dupatta', 'Dupatta', 'drape', ['drape'], 'scarf'),
  type('stole', 'Stole / shawl', 'drape', ['drape'], 'scarf'),

  type('sneakers', 'Sneakers', 'footwear', ['footwear'], 'sneaker'),
  type('running-shoes', 'Running shoes', 'footwear', ['footwear'], 'sneaker'),
  type('boots', 'Boots', 'footwear', ['footwear'], 'boot'),
  type('sandals', 'Sandals', 'footwear', ['footwear'], 'sandal'),
  type('kolhapuris', 'Kolhapuris', 'footwear', ['footwear'], 'sandal'),
  type('juttis', 'Juttis / mojaris', 'footwear', ['footwear'], 'formal-shoe'),
  type('loafers', 'Loafers', 'footwear', ['footwear'], 'formal-shoe'),
  type('formal-shoes', 'Formal shoes', 'footwear', ['footwear'], 'formal-shoe'),
  type('heels', 'Heels', 'footwear', ['footwear'], 'formal-shoe'),

  type('bag', 'Bag', 'accessory', ['accessory'], 'bag'),
  type('belt', 'Belt', 'accessory', ['accessory'], 'belt'),
  type('watch', 'Watch', 'accessory', ['accessory'], 'watch'),
  type('sunglasses', 'Sunglasses', 'accessory', ['accessory'], 'sunglasses'),
  type('scarf', 'Scarf', 'accessory', ['accessory'], 'scarf'),
  type('jewellery', 'Jewellery', 'accessory', ['accessory'], 'jewellery'),
]

const TYPES_BY_ID = new Map(WARDROBE_TYPES.map((entry) => [entry.id, entry]))

export function wardrobeType(id: string): WardrobeType | undefined {
  return TYPES_BY_ID.get(id)
}

export const WARDROBE_TYPE_IDS = WARDROBE_TYPES.map((entry) => entry.id) as [string, ...string[]]

export const COLORS = [
  'black',
  'white',
  'grey',
  'navy',
  'blue',
  'green',
  'olive',
  'beige',
  'cream',
  'brown',
  'tan',
  'red',
  'maroon',
  'pink',
  'purple',
  'yellow',
  'mustard',
  'orange',
  'silver',
  'gold',
  'multi',
] as const
export type Color = (typeof COLORS)[number]

export const MATERIALS = [
  'cotton',
  'linen',
  'khadi',
  'silk',
  'chiffon',
  'georgette',
  'rayon',
  'wool',
  'denim',
  'velvet',
  'leather',
  'suede',
  'polyester',
  'canvas',
  'metal',
] as const

/** Display colour for each vocabulary colour. 'multi' is drawn as stripes. */
export const COLOR_HEX: Record<Color, string> = {
  black: '#23252b',
  white: '#f5f4f0',
  grey: '#8b9099',
  navy: '#25365f',
  blue: '#3c6fc2',
  green: '#3e8a50',
  olive: '#6d7132',
  beige: '#d8c4a2',
  cream: '#efe6cf',
  brown: '#6f4a2f',
  tan: '#b9885b',
  red: '#c53b31',
  maroon: '#7b2336',
  pink: '#e58ba7',
  purple: '#7c50a9',
  yellow: '#e8c547',
  mustard: '#c99a2e',
  orange: '#e07c2f',
  silver: '#c4c8ce',
  gold: '#caa443',
  multi: '#b06aa8',
}

export const OCCASIONS = [
  'everyday',
  'work',
  'college',
  'party',
  'date-night',
  'festive',
  'wedding',
  'travel',
  'gym',
  'lounge',
] as const
export type Occasion = (typeof OCCASIONS)[number]

export const OCCASION_LABELS: Record<Occasion, string> = {
  everyday: 'Everyday',
  work: 'Work',
  college: 'College',
  party: 'Party',
  'date-night': 'Date night',
  festive: 'Festive',
  wedding: 'Wedding',
  travel: 'Travel',
  gym: 'Gym',
  lounge: 'Lounge',
}

/** Ceilings that stop one account turning the wardrobe tables into a dump. */
export const WARDROBE_LIMITS = {
  items: 500,
  outfits: 200,
  batchUpload: 10,
  nameLength: 80,
  outfitNameLength: 60,
  brandLength: 60,
  notesLength: 500,
} as const
