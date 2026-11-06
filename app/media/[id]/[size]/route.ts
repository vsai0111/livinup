import { z } from 'zod'
import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { decideMediaAccess } from '@/lib/media/access'
import { variantKey } from '@/lib/media/repository'
import { getImageStore } from '@/lib/media/store'
import { reportError } from '@/lib/logging/logger'

/**
 * Image delivery.
 *
 *   GET /media/<id>/<sm|md|lg>
 *
 * The only way any stored image reaches a browser. Access is decided per
 * request (lib/media/access.ts); a refusal is a plain 404 so the response does
 * not reveal that an image exists. Published images may be cached for at most
 * an hour, so a removal takes effect well inside the legal takedown windows.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const params = z.object({ id: z.string().uuid(), size: z.enum(['sm', 'md', 'lg']) })

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; size: string }> },
): Promise<Response> {
  const parsed = params.safeParse(await context.params)
  if (!parsed.success) return notFound()
  const { id, size } = parsed.data

  try {
    const [db, session] = await Promise.all([getDb(), getSessionUser()])
    const viewer = session ? { id: session.id, role: session.profile.role } : null
    const decision = await decideMediaAccess(db, id, size, viewer)
    if (!decision.allowed) return notFound()

    const store = await getImageStore()
    const body = await store.get(
      decision.record.bucket,
      variantKey(decision.record.storageKey, size),
    )
    if (!body) return notFound()

    return new Response(new Uint8Array(body), {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(body.byteLength),
        'Cache-Control':
          decision.cache === 'public'
            ? 'public, max-age=3600, s-maxage=3600'
            : 'private, max-age=300',
        // The response is varied by who is asking.
        Vary: 'Cookie',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cross-Origin-Resource-Policy': 'same-origin',
      },
    })
  } catch (error) {
    reportError(error, { operation: 'serveMedia', mediaId: id })
    return new Response('Unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
