import 'server-only'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { publicEnv } from '@/config/env.public'

/**
 * Request-scoped Supabase client backed by the cookie store.
 *
 * Shared by the auth provider and the email-confirmation callback route, which
 * must read the same PKCE code-verifier cookie the signup wrote.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session instead; see proxy.ts.
        }
      },
    },
  })
}
