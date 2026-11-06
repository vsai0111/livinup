import { getSessionUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { reportError } from '@/lib/logging/logger'
import { InvalidImageError, MAX_UPLOAD_BYTES } from '@/lib/media/process'
import { storeUpload, type MediaPurpose } from '@/lib/media/repository'
import { StorageUnavailableError } from '@/lib/media/store'
import { assertWithinLimit } from '@/lib/moderation/rate-limit'
import { UserFacingError } from '@/lib/actions/result'

/**
 * Photo upload.
 *
 *   POST /api/media   multipart/form-data: file, purpose (wardrobe|post|avatar)
 *
 * A route handler rather than a Server Action because Server Actions accept a
 * 1 MB body by default, and a phone photo is larger. The browser resizes
 * before sending, so 4 MB is a generous ceiling and stays under Vercel's 4.5 MB
 * request limit.
 *
 * The upload is not attached to anything yet. It becomes a wardrobe item, a
 * post image or an avatar in a later Server Action, which checks ownership;
 * anything left unattached is removed by the daily cleanup after 24 hours.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PURPOSES: ReadonlySet<string> = new Set(['wardrobe', 'post', 'avatar'])

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSessionUser()
  if (!session) return json({ error: 'You need to be signed in to upload.' }, 401)
  if (session.profile.status !== 'active') {
    return json({ error: 'Uploads are not available for this account.' }, 403)
  }

  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json({ error: 'That photo is larger than 4 MB.' }, 413)
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return json({ error: 'The upload could not be read.' }, 400)
  }

  const purpose = String(form.get('purpose') ?? '')
  const file = form.get('file')
  if (!PURPOSES.has(purpose)) return json({ error: 'Unknown upload type.' }, 400)
  if (!(file instanceof File)) return json({ error: 'Choose a photo to upload.' }, 400)
  if (file.size > MAX_UPLOAD_BYTES) return json({ error: 'That photo is larger than 4 MB.' }, 413)

  try {
    const db = await getDb()
    await assertWithinLimit(db, session.id, 'upload')
    const media = await storeUpload(
      db,
      session.id,
      purpose as MediaPurpose,
      Buffer.from(await file.arrayBuffer()),
    )
    return json({ id: media.id, width: media.width, height: media.height }, 201)
  } catch (error) {
    if (error instanceof InvalidImageError || error instanceof UserFacingError) {
      return json({ error: error.message }, 422)
    }
    if (error instanceof StorageUnavailableError) {
      reportError(error, { operation: 'upload' })
      return json({ error: 'Photo uploads are not available right now.' }, 503)
    }
    const reference = reportError(error, { operation: 'upload', userId: session.id })
    return json({ error: 'The upload failed. Please try again.', reference }, 500)
  }
}
