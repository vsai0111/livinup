import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/auth/supabase-client'
import { resolveSiteOrigin } from '@/lib/auth/site-url'
import { supabaseAuthEnabled } from '@/config/env.public'
import { logger } from '@/lib/logging/logger'
import { safeInternalPath } from '@/lib/utils/url'
import type { AuthCallbackError } from '@/lib/auth/callback-errors'

/**
 * Where Supabase sends people after they click "Confirm email address".
 *
 * Supabase does not create the session itself — it hands back a one-time value
 * that has to be redeemed for one. Two shapes arrive here depending on how the
 * project's email template is written:
 *
 *   `?code=…`                  PKCE. Redeemed against the code-verifier cookie
 *                              that signup left in this browser.
 *   `?token_hash=…&type=email` The older link format, verified directly.
 *
 * Both are supported because the template is dashboard configuration, not
 * something this codebase controls. Landing anywhere else with the code in the
 * query string — the site root, say — leaves the account confirmed but the
 * visitor still signed out, with nothing on screen to explain why.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const next = safeInternalPath(searchParams.get('next'), '/home')
  // Not `nextUrl.origin`: behind Vercel's proxy that can resolve to the internal
  // hostname, which would bounce the user somewhere unreachable at the very last
  // step. This is the same origin the emailed link was built from.
  const origin = await resolveSiteOrigin()

  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null

  // Supabase reports a rejected or expired link in the query string rather than
  // by status code, so it has to be read before anything is redeemed.
  if (searchParams.get('error') || searchParams.get('error_description')) {
    return NextResponse.redirect(signInWithError(origin, next, 'link_invalid'))
  }

  if (!supabaseAuthEnabled) {
    return NextResponse.redirect(new URL(next, origin))
  }

  if (!code && !tokenHash) {
    return NextResponse.redirect(signInWithError(origin, next, 'link_invalid'))
  }

  const supabase = await createSupabaseServerClient()

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type ?? 'email' })

  if (error) {
    logger.warn('email confirmation exchange failed', { code: error.code, status: error.status })
    // PKCE ties the link to the browser that signed up, so opening the mail on
    // a different device is the common cause here and is not obvious.
    return NextResponse.redirect(signInWithError(origin, next, 'link_expired'))
  }

  return NextResponse.redirect(new URL(next, origin))
}

/**
 * Failures are reported to /signin as a fixed code, never as prose.
 *
 * The wording is chosen there. Passing the message itself through the query
 * string would let anyone hand out a genuine-looking LivinUp sign-in link
 * displaying whatever text they liked.
 */
function signInWithError(origin: string, next: string, reason: AuthCallbackError): URL {
  const url = new URL('/signin', origin)
  url.searchParams.set('next', next)
  url.searchParams.set('error', reason)
  return url
}
