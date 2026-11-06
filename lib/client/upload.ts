'use client'

/**
 * Browser side of a photo upload.
 *
 * The photo is decoded (with its camera rotation applied), scaled so its long
 * edge is at most 2048 px and re-encoded as JPEG before it leaves the device.
 * That keeps uploads small on mobile data and drops location metadata early.
 * The server validates and re-encodes again regardless; nothing here is a
 * security control.
 */

const MAX_EDGE = 2048
const QUALITY = 0.88

export type UploadPurpose = 'wardrobe' | 'post' | 'avatar'

export interface UploadedMedia {
  id: string
  width: number
  height: number
}

async function prepare(file: File): Promise<Blob> {
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // Formats the browser cannot decode (often HEIC) go up as they are, and the
    // server answers with a specific message.
    return file
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  // White behind transparent PNGs, so they do not turn black as JPEG.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', QUALITY),
  )
  return blob ?? file
}

export async function uploadPhoto(file: File, purpose: UploadPurpose): Promise<UploadedMedia> {
  const body = await prepare(file)
  const form = new FormData()
  form.set('purpose', purpose)
  form.set('file', body, 'photo.jpg')

  let response: Response
  try {
    response = await fetch('/api/media', { method: 'POST', body: form })
  } catch {
    throw new Error('The upload did not reach the server. Check your connection and try again.')
  }

  const payload = (await response.json().catch(() => ({}))) as {
    id?: string
    width?: number
    height?: number
    error?: string
  }
  if (!response.ok || !payload.id) {
    throw new Error(payload.error ?? 'The upload failed. Please try again.')
  }
  return { id: payload.id, width: payload.width ?? 0, height: payload.height ?? 0 }
}

/** A local preview URL for a chosen file. Remember to revoke it. */
export function previewUrl(file: File): string {
  return URL.createObjectURL(file)
}
