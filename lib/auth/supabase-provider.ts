import 'server-only'
import { createSupabaseServerClient } from './supabase-client'
import { logger } from '@/lib/logging/logger'
import type { AuthProvider, AuthErrorCode, AuthResult } from './types'

/**
 * Supabase Auth provider — the production path.
 *
 * Uses `@supabase/ssr` so the session lives in HttpOnly cookies managed by
 * Supabase and is verified server-side on every request. Only the publishable
 * key is used here.
 *
 * Google sign-in additionally needs the Google provider enabled in the
 * Supabase dashboard (Authentication → Providers); until it is,
 * `googleSignInUrl` returns null and the UI says so.
 */
export class SupabaseAuthProvider implements AuthProvider {
  readonly id = 'supabase' as const

  private async client() {
    return createSupabaseServerClient()
  }

  private mapError(message: string, status?: number): { code: AuthErrorCode; message: string } {
    const text = message.toLowerCase()
    if (text.includes('already registered') || text.includes('already exists')) {
      return { code: 'email_taken', message: 'An account already exists for that email address.' }
    }
    // Must precede the generic `email` branch below, which would otherwise
    // report an unverified address as a malformed one.
    if (text.includes('not confirmed') || text.includes('email_not_confirmed')) {
      return {
        code: 'email_not_confirmed',
        message:
          'Confirm your email address before signing in. Check your inbox for the verification link.',
      }
    }
    if (text.includes('invalid login') || text.includes('invalid credentials')) {
      return {
        code: 'invalid_credentials',
        message: 'That email and password combination is not correct.',
      }
    }
    if (text.includes('password')) {
      return { code: 'weak_password', message: 'Choose a stronger password.' }
    }
    if (text.includes('email')) {
      return { code: 'invalid_email', message: 'Enter a valid email address.' }
    }
    if (status === 429) {
      return { code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' }
    }
    return { code: 'unavailable', message: 'Sign-in is temporarily unavailable. Please try again.' }
  }

  async signUp({
    email,
    password,
    emailRedirectTo,
  }: {
    email: string
    password: string
    emailRedirectTo?: string
  }): Promise<AuthResult> {
    const supabase = await this.client()
    // Without `emailRedirectTo`, Supabase falls back to the Site URL configured
    // in the dashboard for *every* environment. That default is localhost, so
    // production confirmation mails shipped a link to the recipient's own
    // machine and died with ERR_CONNECTION_REFUSED.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    })

    if (error) {
      logger.warn('supabase signup failed', { code: error.code, status: error.status })
      return { ok: false, ...this.mapError(error.message, error.status) }
    }
    if (!data.user) {
      return {
        ok: false,
        code: 'unavailable',
        message: 'Account created but no session was returned. Check your email to confirm.',
      }
    }

    // Supabase returns a user but no session when email confirmation is on. The
    // account is real and the verification mail has been sent; the caller must
    // say so rather than redirecting into a protected route that will bounce
    // straight back to sign-in with no explanation.
    return {
      ok: true,
      user: { id: data.user.id, email: data.user.email ?? email },
      confirmationRequired: !data.session,
    }
  }

  async signIn({ email, password }: { email: string; password: string }): Promise<AuthResult> {
    const supabase = await this.client()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.user) {
      logger.warn('supabase signin failed', { code: error?.code, status: error?.status })
      return { ok: false, ...this.mapError(error?.message ?? '', error?.status) }
    }

    return { ok: true, user: { id: data.user.id, email: data.user.email ?? email } }
  }

  async signOut(): Promise<void> {
    const supabase = await this.client()
    await supabase.auth.signOut()
  }

  async getUser() {
    const supabase = await this.client()
    // getUser() revalidates the JWT with Supabase rather than trusting the
    // cookie's contents, which is what makes this safe to authorise on.
    const { data, error } = await supabase.auth.getUser()
    if (error || !data.user) return null
    return { id: data.user.id, email: data.user.email ?? '' }
  }

  async requestPasswordReset({ email, redirectTo }: { email: string; redirectTo: string }) {
    const supabase = await this.client()
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo })
    // Logged, never surfaced: the caller shows the same message either way.
    if (error)
      logger.warn('supabase password reset failed', { code: error.code, status: error.status })
  }

  async resetPassword({ password }: { password: string }): Promise<AuthResult> {
    const supabase = await this.client()
    const { data: current } = await supabase.auth.getUser()
    if (!current.user) {
      return {
        ok: false,
        code: 'not_authenticated',
        message: 'That reset link is not valid or has expired. Request a new one.',
      }
    }
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error || !data.user)
      return { ok: false, ...this.mapError(error?.message ?? '', error?.status) }
    return { ok: true, user: { id: data.user.id, email: data.user.email ?? '' } }
  }

  async changePassword({ current, next }: { current: string; next: string }): Promise<AuthResult> {
    const supabase = await this.client()
    const { data: me } = await supabase.auth.getUser()
    const email = me.user?.email
    if (!email) {
      return {
        ok: false,
        code: 'not_authenticated',
        message: 'Password sign-in is not set up for this account.',
      }
    }
    // Re-check the current password before changing it.
    const check = await supabase.auth.signInWithPassword({ email, password: current })
    if (check.error) {
      return {
        ok: false,
        code: 'invalid_credentials',
        message: 'Your current password is not correct.',
      }
    }
    const { data, error } = await supabase.auth.updateUser({ password: next })
    if (error || !data.user)
      return { ok: false, ...this.mapError(error?.message ?? '', error?.status) }
    return { ok: true, user: { id: data.user.id, email } }
  }

  async googleSignInUrl(redirectTo: string): Promise<string | null> {
    const supabase = await this.client()
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error || !data.url) {
      logger.warn('google sign-in unavailable', { code: error?.code, status: error?.status })
      return null
    }
    return data.url
  }
}
