import { ItemThumb } from '@/components/wardrobe/ItemThumb'
import { cn } from '@/lib/utils/cn'
import type { WardrobeItem } from '@/types/wardrobe'

/** Up to four pieces of an outfit as a 2×2 collage. */
export function OutfitCollage({ items, className }: { items: WardrobeItem[]; className?: string }) {
  const shown = items.slice(0, 4)
  return (
    <div
      className={cn(
        'bg-surface-sunken grid aspect-square grid-cols-2 gap-0.5 overflow-hidden',
        className,
      )}
    >
      {shown.map((item) => (
        <ItemThumb
          key={item.id}
          item={item}
          className={cn(
            'h-full w-full',
            shown.length === 1 && 'col-span-2 row-span-2',
            shown.length === 3 && item === shown[0] && 'row-span-2',
          )}
        />
      ))}
      {shown.length === 0 && (
        <div className="text-ink-subtle col-span-2 row-span-2 flex items-center justify-center text-xs">
          No pieces left
        </div>
      )}
    </div>
  )
}
