/**
 * Illustrative data for the landing-page product mockups.
 *
 * These are marketing visuals — the equivalent of a product screenshot — not a
 * live view of the catalogue. They are kept here, apart from the components, so
 * it is obvious at a glance that the landing page invents nothing beyond them.
 *
 * Two rules govern what may appear below:
 *
 *   1. Every field corresponds to something the application genuinely computes.
 *      Prices, the 30/90-day typical, the lowest recorded price, the observation
 *      count, the five deal bands and the preference-match percentage are all
 *      real outputs of lib/deals and lib/recommendations. Nothing here is a
 *      metric the product cannot actually produce.
 *   2. Attribute values come from the controlled vocabulary in config/taxonomy —
 *      `boxy`, `relaxed`, `tailored` are real fits, not invented ones.
 *
 * Imagery reuses /api/product-image, the same deterministic placeholder route
 * the catalogue itself uses, rather than stock photography of products that do
 * not exist.
 */

export interface ShowcaseProduct {
  slug: string
  brand: string
  title: string
  price: string
  wasPrice?: string
  merchant: string
  band: 'excellent' | 'great' | 'good' | 'fair' | 'poor' | null
  bandLabel?: string
  reason?: string
}

/** The feed shown in the hero window. */
export const SHOWCASE_FEED: readonly ShowcaseProduct[] = [
  {
    slug: 'north-loop-boxy-oxford',
    brand: 'North Loop',
    title: 'Boxy Oxford Shirt',
    price: '$68',
    wasPrice: '$95',
    merchant: 'Two Rivers',
    band: 'great',
    bandLabel: 'Great',
    reason: 'Matches boxy fit and cotton',
  },
  {
    slug: 'harrow-merino-crew',
    brand: 'Harrow',
    title: 'Merino Crew Knit',
    price: '$124',
    merchant: 'Fieldhouse',
    band: 'good',
    bandLabel: 'Good',
    reason: 'Matches knitwear and neutral',
  },
  {
    slug: 'calder-relaxed-chino',
    brand: 'Calder',
    title: 'Relaxed Chino',
    price: '$79',
    wasPrice: '$110',
    merchant: 'Two Rivers',
    band: 'excellent',
    bandLabel: 'Excellent',
    reason: 'Lowest price recorded so far',
  },
  {
    slug: 'ashby-canvas-tote',
    brand: 'Ashby',
    title: 'Canvas Weekend Tote',
    price: '$142',
    merchant: 'Halden & Co',
    band: null,
    reason: 'Recently added',
  },
]

/**
 * The price-intelligence example.
 *
 * `points` are monthly observations for one listing; the statistics beneath are
 * derived from exactly those numbers, so the panel and the chart agree.
 */
export const SHOWCASE_PRICE = {
  product: 'Calder Relaxed Chino',
  merchant: 'Two Rivers',
  currency: '$',
  points: [110, 110, 104, 110, 98, 110, 110, 92, 105, 110, 88, 79],
  months: [
    'Oct',
    'Nov',
    'Dec',
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
  ] as const,
  current: '$79',
  typical30: '$99',
  typical90: '$103',
  lowest: '$79',
  observations: 12,
  band: 'excellent' as const,
  bandLabel: 'Excellent',
  score: 94,
  reasons: [
    { sentiment: 'positive' as const, text: '28% below the 90-day typical price of $103.' },
    { sentiment: 'positive' as const, text: 'The lowest price recorded for this listing.' },
    { sentiment: 'neutral' as const, text: 'Based on 12 recorded prices over 341 days.' },
  ],
}

/** The personalisation example — real taxonomy values, real scoring shape. */
export const SHOWCASE_PREFERENCES = [
  { attribute: 'fit', value: 'Boxy', selected: true },
  { attribute: 'fit', value: 'Relaxed', selected: true },
  { attribute: 'fit', value: 'Tailored', selected: false },
  { attribute: 'style', value: 'Minimal', selected: true },
  { attribute: 'color', value: 'Olive', selected: true },
  { attribute: 'material', value: 'Cotton', selected: false },
] as const

export const SHOWCASE_MATCH = {
  product: 'North Loop Boxy Oxford Shirt',
  percent: '86%',
  matched: ['Boxy', 'Cotton', 'Minimal'],
  missed: ['Olive'],
}

/** Merchant comparison. LivinUp claims only the merchants it has ingested. */
export const SHOWCASE_OFFERS = [
  { merchant: 'Two Rivers', price: '$79', availability: 'In stock', best: true },
  { merchant: 'Fieldhouse', price: '$86', availability: 'In stock', best: false },
  { merchant: 'Halden & Co', price: '$94', availability: 'Low stock', best: false },
]

/**
 * The fan of cards under the hero.
 *
 * Seven rather than four, because an arc needs enough members to read as a
 * curve. Same rules as everything above: real deal bands, real taxonomy terms,
 * and the deterministic placeholder imagery the catalogue itself uses.
 */
export const SHOWCASE_ARC: readonly ShowcaseProduct[] = [
  ...SHOWCASE_FEED,
  {
    slug: 'voss-atelier-wool-overcoat',
    brand: 'Voss Atelier',
    title: 'Wool Overcoat',
    price: '$394',
    merchant: 'Fieldhouse',
    band: 'fair',
    bandLabel: 'Fair',
  },
  {
    slug: 'tenby-suede-penny-loafer',
    brand: 'Tenby',
    title: 'Suede Penny Loafer',
    price: '$197',
    wasPrice: '$240',
    merchant: 'Halden & Co',
    band: 'good',
    bandLabel: 'Good',
  },
  {
    slug: 'oland-ceramic-table-lamp',
    brand: 'Öland',
    title: 'Ceramic Table Lamp',
    price: '$155',
    merchant: 'Two Rivers',
    band: 'great',
    bandLabel: 'Great',
  },
]
