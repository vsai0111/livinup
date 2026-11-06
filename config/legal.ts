/**
 * Legal and grievance details shown on the public pages.
 *
 * PLACEHOLDERS. The grievance officer must be a named person with a working
 * contact before launch (docs/product-spec.md 9 and 12). Until these are set
 * from the environment, the legal pages show a visible "draft" notice.
 */
export const LEGAL = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_ENTITY || 'LivinUp',
  grievanceOfficerName: process.env.NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME || '',
  grievanceEmail: process.env.NEXT_PUBLIC_GRIEVANCE_EMAIL || '',
  lastUpdated: '31 October 2026',
} as const

export const LEGAL_CONFIGURED = Boolean(LEGAL.grievanceOfficerName && LEGAL.grievanceEmail)

/**
 * Set to true, in code, only once a qualified lawyer has reviewed the texts of
 * /terms, /privacy, /guidelines and /grievance. Until then every legal page
 * shows a visible draft notice, whether or not the grievance officer is set.
 * Deliberately not an environment variable: removing the notice should be a
 * reviewed code change. See docs/deployment-v1-checklist.md.
 */
export const LEGAL_REVIEWED = false
