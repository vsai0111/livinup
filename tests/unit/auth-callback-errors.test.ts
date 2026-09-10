import { describe, expect, it } from 'vitest'
import { authCallbackMessage } from '@/lib/auth/callback-errors'

/**
 * The confirmation callback reports failures to /signin through the URL, so
 * whatever arrives in `?error=` is attacker-controllable by the time the page
 * reads it. Only known codes may produce text on screen.
 */
describe('authCallbackMessage', () => {
  it('resolves the codes the callback emits', () => {
    expect(authCallbackMessage('link_invalid')).toMatch(/not valid/i)
    expect(authCallbackMessage('link_expired')).toMatch(/expired/i)
  })

  it('refuses to echo arbitrary text back to the page', () => {
    expect(authCallbackMessage('Call 1-800-NOT-LIVINUP to unlock your account')).toBeNull()
    expect(authCallbackMessage('')).toBeNull()
    expect(authCallbackMessage(undefined)).toBeNull()
    expect(authCallbackMessage(['link_invalid'])).toBeNull()
  })

  it('does not resolve inherited Object properties', () => {
    expect(authCallbackMessage('toString')).toBeNull()
    expect(authCallbackMessage('constructor')).toBeNull()
  })
})
