import { mediaUrl, type MediaSizeName } from '@/lib/media/url'
import { cn } from '@/lib/utils/cn'

/**
 * An image served through /media.
 *
 * A plain <img>, deliberately not next/image: these responses depend on who is
 * asking (wardrobe photos are owner-only), and the image optimiser would fetch
 * them without the viewer's cookies. They are already resized on upload.
 */
export function MediaImage({
  id,
  size = 'md',
  alt,
  className,
  priority = false,
}: {
  id: string
  size?: MediaSizeName
  alt: string
  className?: string
  priority?: boolean
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mediaUrl(id, size)}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      className={cn('block h-full w-full object-cover', className)}
    />
  )
}
