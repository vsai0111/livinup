import 'server-only'
import { headers } from 'next/headers'
import { publicEnv } from '@/config/env.public'

/**
 * The public origin this deployment is reachable at.
 *
 * Supabase bakes an absolute URL into the confirmation email, so it has to be
 * resolved on the server at signup time. Getting it wrong is not a cosmetic
 * problem: the link is dead by the time it lands in an inbox.
 *
 * Order matters, and it is a trust order rather than a convenience one:
 *
 *   1. `NEXT_PUBLIC_APP_URL` — set by us, so it is the only source we fully
 *      trust. Wins whenever it is configured.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel's own view of the production
 *      domain, injected by the platform rather than the request.
 *   3. The forwarded request host — needed for preview deployments and local
 *      dev, where neither of the above exists.
 *
 * The request host is last because `Host` and `X-Forwarded-Host` are supplied
 * by the client. An attacker who controls them can only redirect the mail for a
 * signup they performed themselves, and Supabase's Redirect URL allowlist
 * rejects the result anyway — but it costs nothing to prefer a value we set.
 */
export async function resolveSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return stripTrailingSlash(configured)

  const vercelProduction = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercelProduction) return `https://${stripTrailingSlash(vercelProduction)}`

  const requestOrigin = await originFromHeaders()
  if (requestOrigin) return requestOrigin

  return stripTrailingSlash(publicEnv.appUrl)
}

async function originFromHeaders(): Promise<string | null> {
  try {
    const headerList = await headers()
    // `x-forwarded-host` is what the proxy saw; `host` is what reached this
    // process, which behind Vercel is an internal name and useless here.
    const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
    if (!host) return null

    const forwardedProto = headerList.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const protocol = forwardedProto || (host.startsWith('localhost') ? 'http' : 'https')

    return `${protocol}://${stripTrailingSlash(host)}`
  } catch {
    // No request context (build-time render, background job).
    return null
  }
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '')
}
