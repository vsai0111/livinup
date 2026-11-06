import { RESERVED_USERNAMES, USERNAME_PATTERN } from '@/config/community'

/**
 * Username rules (docs/product-spec.md 5.2). Pure, shared by the form and the
 * server.
 *
 * 3–30 characters from a–z, 0–9, "." and "_", starting with a letter. Stored
 * lower-case and unique regardless of case. Reserved words are refused.
 */
export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, '').toLowerCase()
}

export function usernameProblem(value: string): string | null {
  const name = normalizeUsername(value)
  if (name.length < 3) return 'Use at least 3 characters.'
  if (name.length > 30) return 'Use 30 characters or fewer.'
  if (!/^[a-z]/.test(name)) return 'Start with a letter.'
  if (!USERNAME_PATTERN.test(name)) return 'Use only letters, numbers, dots and underscores.'
  if (/[._]{2}/.test(name)) return 'Avoid two dots or underscores in a row.'
  if (/[._]$/.test(name)) return 'End with a letter or number.'
  if (RESERVED_USERNAMES.has(name)) return 'That username is reserved.'
  return null
}

/** A starting suggestion from a display name: "Asha Rao" -> "asha.rao". */
export function suggestUsername(displayName: string): string {
  const base = displayName
    .normalize('NFKD')
    .replace(/[^\w\s.]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '')
    .replace(/[._]{2,}/g, '.')
    .replace(/^[^a-z]+/, '')
    .replace(/[._]+$/, '')
    .slice(0, 24)
  return base.length >= 3 ? base : ''
}
