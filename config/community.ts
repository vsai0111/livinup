/** Community rules: limits, report reasons, rate limits, reserved usernames. */

export const POST_LIMITS = {
  images: 4,
  captionLength: 1000,
  brandTags: 5,
  altTextLength: 200,
  commentLength: 500,
  bioLength: 160,
  displayNameLength: 80,
} as const

/** Per-account rate limits (spec 7.6). Window is in seconds. */
export const RATE_LIMITS = {
  post: { max: 20, windowSeconds: 24 * 60 * 60 },
  comment: { max: 60, windowSeconds: 60 * 60 },
  follow: { max: 200, windowSeconds: 24 * 60 * 60 },
  upload: { max: 100, windowSeconds: 24 * 60 * 60 },
  report: { max: 20, windowSeconds: 24 * 60 * 60 },
} as const
export type RateLimitedAction = keyof typeof RATE_LIMITS

export const REPORT_REASONS = [
  'intimate_image',
  'child_safety',
  'harassment',
  'hate',
  'violence',
  'impersonation',
  'spam',
  'copyright',
  'other',
] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  intimate_image: 'Intimate image shared without consent',
  child_safety: 'Child safety',
  harassment: 'Bullying or harassment',
  hate: 'Hate speech',
  violence: 'Violence or threats',
  impersonation: 'Impersonation',
  spam: 'Spam or scam',
  copyright: 'Copyright or someone else’s photo',
  other: 'Something else',
}

/** Reasons that go to the top of the queue and trigger an immediate alert. */
export const URGENT_REASONS: ReadonlySet<ReportReason> = new Set(['intimate_image', 'child_safety'])

export const USERNAME_PATTERN = /^[a-z][a-z0-9._]{2,29}$/

/** Usernames that would collide with routes, roles or the brand itself. */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'api',
  'auth',
  'brands',
  'create',
  'explore',
  'help',
  'home',
  'livinup',
  'login',
  'logout',
  'me',
  'media',
  'moderator',
  'notifications',
  'onboarding',
  'outfits',
  'privacy',
  'profile',
  'root',
  'settings',
  'signin',
  'signup',
  'staff',
  'support',
  'system',
  'terms',
  'wardrobe',
])

/** How long notifications are kept. */
export const NOTIFICATION_RETENTION_DAYS = 90
