import { MediaImage } from '@/components/media/MediaImage'
import { cn } from '@/lib/utils/cn'
import { GarmentIcon, hexFor } from './GarmentIcon'

/**
 * The picture for a wardrobe item: its photo, or a soft colour tile with the
 * garment drawn on it when there is no photo.
 */
export function ItemThumb({
  item,
  size = 'sm',
  className,
}: {
  item: { name: string; itemType: string; color: string; mediaId: string | null }
  size?: 'sm' | 'md'
  className?: string
}) {
  if (item.mediaId) {
    return (
      <div className={cn('bg-surface-sunken overflow-hidden', className)}>
        <MediaImage id={item.mediaId} size={size} alt={item.name} />
      </div>
    )
  }
  return (
    <div
      role="img"
      aria-label={item.name}
      className={cn('flex items-center justify-center overflow-hidden', className)}
      style={{ backgroundColor: `color-mix(in srgb, ${hexFor(item.color)} 12%, #f6f7f9)` }}
    >
      <GarmentIcon itemType={item.itemType} color={item.color} className="h-3/5 w-3/5" />
    </div>
  )
}
