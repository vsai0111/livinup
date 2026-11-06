/**
 * URL handling.
 *
 * Untrusted URLs — a brand's website, a `next` parameter — are only ever used
 * after these checks. A `javascript:` URL in an href is stored XSS, and an
 * unchecked `next` turns sign-in into an open redirect.
 */

const SAFE_PROTOCOLS = new Set(['http:', 'https:'])

export function parseUrl(value: unknown): URL | null {
  if (typeof value !== 'string' || value.trim() === '') return null
  try {
    return new URL(value.trim())
  } catch {
    return null
  }
}

/** True only for absolute http(s) URLs. Everything else is rejected. */
export function isSafeHttpUrl(value: unknown): boolean {
  const url = parseUrl(value)
  return url !== null && SAFE_PROTOCOLS.has(url.protocol)
}

/** Build an app-relative path, refusing anything that would leave the origin. */
export function safeInternalPath(value: unknown, fallback = '/'): string {
  if (typeof value !== 'string' || !value.startsWith('/')) return fallback
  // "//evil.com" is protocol-relative and leaves the origin.
  if (value.startsWith('//') || value.startsWith('/\\')) return fallback
  return value
}

/** A website URL for display: "brand.in" rather than "https://www.brand.in/". */
export function displayHost(value: string): string {
  const url = parseUrl(value)
  if (!url) return value
  return url.hostname.replace(/^www\./, '')
}
