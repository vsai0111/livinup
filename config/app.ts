/** Static application metadata and navigation. */

export const APP_NAME = 'LivinUp'
export const APP_TAGLINE = 'Your wardrobe, your outfits, your style.'
export const APP_DESCRIPTION =
  'LivinUp turns the clothes you already own into a private digital wardrobe, helps you build outfits from them, and lets you share your style with people who care about fashion.'

/** Primary signed-in navigation, in sidebar order. */
export const PRIMARY_NAV = [
  { href: '/home', label: 'Home', icon: 'home' },
  { href: '/wardrobe', label: 'Wardrobe', icon: 'hanger' },
  { href: '/outfits', label: 'Outfits', icon: 'layers' },
  { href: '/create', label: 'Create', icon: 'plus' },
  { href: '/notifications', label: 'Notifications', icon: 'bell' },
  { href: '/brands', label: 'Brands', icon: 'tag' },
] as const

/** Dates and relative times are written the way readers in India expect. */
export const DEFAULT_LOCALE = 'en-IN'

/** Cookie remembering whether the sidebar is collapsed. A UI preference, not a secret. */
export const SIDEBAR_COOKIE = 'livinup_sidebar'

/** Page sizes used across the app. */
export const PAGE_SIZE = {
  feed: 20,
  profilePosts: 24,
  comments: 50,
  notifications: 40,
  admin: 50,
} as const
