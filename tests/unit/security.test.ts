import { describe, expect, it } from 'vitest'
import { displayHost, isSafeHttpUrl, parseUrl, safeInternalPath } from '@/lib/utils/url'
import { createSessionToken, readSessionToken } from '@/lib/auth/session'
import { checkPasswordPolicy, hashPassword, verifyPassword } from '@/lib/auth/password'

/**
 * Security-focused tests.
 *
 * These cover the places where untrusted input reaches something dangerous:
 * outbound redirects, stored URLs that end up in href attributes, session
 * tokens, and password verification.
 */

describe('URL safety', () => {
  it('accepts only absolute http(s) URLs', () => {
    expect(isSafeHttpUrl('https://example.com/p/1')).toBe(true)
    expect(isSafeHttpUrl('http://example.com')).toBe(true)

    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeHttpUrl('vbscript:msgbox(1)')).toBe(false)
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeHttpUrl('/relative/path')).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl(undefined)).toBe(false)
  })

  it('rejects protocol tricks that look like http', () => {
    expect(isSafeHttpUrl('javascript:https://example.com')).toBe(false)
    // A newline inside the scheme is a classic filter bypass.
    expect(isSafeHttpUrl('java\nscript:alert(1)')).toBe(false)
  })

  it('shows a brand website as a bare host', () => {
    expect(displayHost('https://www.brand.in/')).toBe('brand.in')
    expect(displayHost('not a url')).toBe('not a url')
  })

  it('keeps internal redirect paths on-origin', () => {
    expect(safeInternalPath('/home')).toBe('/home')
    expect(safeInternalPath('/wardrobe?group=top')).toBe('/wardrobe?group=top')

    expect(safeInternalPath('//evil.com')).toBe('/')
    expect(safeInternalPath('/\\evil.com')).toBe('/')
    expect(safeInternalPath('https://evil.com')).toBe('/')
    expect(safeInternalPath('javascript:alert(1)')).toBe('/')
    expect(safeInternalPath(undefined)).toBe('/')
    expect(safeInternalPath(123)).toBe('/')
  })

  it('parses without throwing on rubbish', () => {
    expect(parseUrl('not a url')).toBeNull()
    expect(parseUrl({})).toBeNull()
  })
})

describe('session tokens', () => {
  it('round-trips a valid token', () => {
    const token = createSessionToken('11111111-1111-1111-1111-111111111111')
    expect(readSessionToken(token)).toBe('11111111-1111-1111-1111-111111111111')
  })

  it('rejects a tampered payload', () => {
    const token = createSessionToken('11111111-1111-1111-1111-111111111111')
    const [body, signature] = token.split('.')

    const forgedBody = Buffer.from(
      JSON.stringify({ sub: '22222222-2222-2222-2222-222222222222', exp: 9_999_999_999 }),
    ).toString('base64url')

    expect(readSessionToken(`${forgedBody}.${signature}`)).toBeNull()
    expect(readSessionToken(`${body}.deadbeef`)).toBeNull()
  })

  it('rejects an expired token', () => {
    const expired = createSessionToken('11111111-1111-1111-1111-111111111111', -10)
    expect(readSessionToken(expired)).toBeNull()
  })

  it('rejects malformed input without throwing', () => {
    expect(readSessionToken(undefined)).toBeNull()
    expect(readSessionToken('')).toBeNull()
    expect(readSessionToken('nodot')).toBeNull()
    expect(readSessionToken('...')).toBeNull()
    expect(readSessionToken('a.b.c')).toBeNull()
  })
})

describe('passwords', () => {
  it('enforces a length floor', () => {
    expect(checkPasswordPolicy('short').ok).toBe(false)
    expect(checkPasswordPolicy('a-long-enough-password').ok).toBe(true)
  })

  it('rejects well-known passwords', () => {
    expect(checkPasswordPolicy('password123').ok).toBe(false)
    expect(checkPasswordPolicy('PASSWORD123').ok).toBe(false)
  })

  it('hashes and verifies', async () => {
    const hash = await hashPassword('correct-horse-battery-staple')
    expect(hash).toMatch(/^scrypt\$/)
    // The password must not be recoverable from the stored value.
    expect(hash).not.toContain('correct-horse')

    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true)
    expect(await verifyPassword('wrong-password-entirely', hash)).toBe(false)
  })

  it('produces a different hash each time for the same password', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password-here'),
      hashPassword('same-password-here'),
    ])
    expect(a).not.toBe(b)
  })

  it('returns false for a corrupt stored hash instead of throwing', async () => {
    expect(await verifyPassword('anything', 'not-a-hash')).toBe(false)
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'scrypt$1$2$3')).toBe(false)
  })
})
