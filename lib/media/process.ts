import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Validating and re-encoding uploaded photos.
 *
 * The browser already resizes and re-encodes before upload, but nothing from
 * the client is trusted: the type is read from the file's bytes, the image is
 * decoded and re-encoded here with `sharp`, which drops every piece of
 * metadata (location, camera, timestamps), and only the re-encoded output is
 * ever stored.
 */

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024
const MAX_INPUT_PIXELS = 40_000_000
const MIN_SIDE = 64

/** Stored sizes. `lg` is kept for wardrobe originals only. */
export const MEDIA_SIZES = { sm: 320, md: 1080, lg: 2048 } as const
export type MediaSize = keyof typeof MEDIA_SIZES

export type SniffedType = 'image/jpeg' | 'image/png' | 'image/webp'

export class InvalidImageError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidImageError'
  }
}

/** Identify a JPEG, PNG or WebP from its leading bytes. Anything else is null. */
export function sniffImageType(bytes: Uint8Array): SniffedType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) {
    return 'image/webp'
  }
  return null
}

/** True for HEIC/HEIF (iPhone) files, which get a specific message. */
export function looksLikeHeic(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false
  const box = String.fromCharCode(...bytes.slice(4, 8))
  const brand = String.fromCharCode(...bytes.slice(8, 12))
  return box === 'ftyp' && /^(heic|heix|hevc|hevx|mif1|msf1|heim|heis)$/.test(brand)
}

export interface ProcessedImage {
  variants: Partial<Record<MediaSize, Buffer>>
  width: number
  height: number
  bytes: number
  sha256: string
}

/**
 * Decode, auto-rotate, strip metadata and produce the stored sizes as WebP.
 *
 * `keepLarge` keeps the 2048px version (wardrobe originals, for future
 * analysis). Published copies only need sm and md.
 */
export async function processImage(
  input: Buffer,
  options: { keepLarge: boolean },
): Promise<ProcessedImage> {
  if (input.byteLength === 0) throw new InvalidImageError('The file is empty.')
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new InvalidImageError('That photo is larger than 4 MB.')
  }
  if (looksLikeHeic(input)) {
    throw new InvalidImageError(
      'HEIC photos are not supported yet. Choose "Most compatible" in your camera settings, or upload a JPEG.',
    )
  }
  if (!sniffImageType(input)) {
    throw new InvalidImageError('Only JPEG, PNG and WebP photos can be uploaded.')
  }

  const { default: sharp } = await import('sharp')

  let base
  try {
    // rotate() with no argument applies the EXIF orientation, then the output
    // carries no metadata at all because withMetadata() is never called.
    base = sharp(input, { failOn: 'error', limitInputPixels: MAX_INPUT_PIXELS }).rotate()
    const meta = await base.metadata()
    if (!meta.width || !meta.height) throw new Error('no dimensions')
    if (Math.min(meta.width, meta.height) < MIN_SIDE) {
      throw new InvalidImageError('That photo is too small. Use one at least 64 pixels across.')
    }
  } catch (error) {
    if (error instanceof InvalidImageError) throw error
    throw new InvalidImageError('That file could not be read as an image.')
  }

  const sizes: MediaSize[] = options.keepLarge ? ['sm', 'md', 'lg'] : ['sm', 'md']
  const variants: Partial<Record<MediaSize, Buffer>> = {}
  let width = 0
  let height = 0

  for (const size of sizes) {
    const { data, info } = await base
      .clone()
      .resize({
        width: MEDIA_SIZES[size],
        height: MEDIA_SIZES[size],
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: size === 'sm' ? 74 : 82 })
      .toBuffer({ resolveWithObject: true })
    variants[size] = data
    // Record the dimensions of the largest stored variant.
    if (info.width * info.height >= width * height) {
      width = info.width
      height = info.height
    }
  }

  const largest = variants.lg ?? variants.md!
  return {
    variants,
    width,
    height,
    bytes: largest.byteLength,
    sha256: createHash('sha256').update(largest).digest('hex'),
  }
}
