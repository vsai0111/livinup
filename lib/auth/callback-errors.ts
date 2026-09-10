/**
 * Outcomes the email-confirmation callback can report to the sign-in page.
 *
 * Codes rather than sentences: the callback redirects through the URL bar, and
 * anything it puts there is attacker-supplied by the time /signin reads it.
 * Only these two values map to a message; everything else is ignored.
 */
export type AuthCallbackError = 'link_invalid' | 'link_expired'

const MESSAGES: Record<AuthCallbackError, string> = {
  link_invalid: 'That confirmation link is not valid. Sign in, or create your account again.',
  link_expired:
    'That confirmation link has expired, or was opened in a different browser from the one you signed up in. Sign in to continue.',
}

/** The message for a callback error code, or null when the code is unknown. */
export function authCallbackMessage(value: unknown): string | null {
  // `Object.hasOwn`, not `in`: `in` walks the prototype chain, so `?error=toString`
  // would resolve to a function and be handed to the page as its message.
  return typeof value === 'string' && Object.hasOwn(MESSAGES, value)
    ? MESSAGES[value as AuthCallbackError]
    : null
}
