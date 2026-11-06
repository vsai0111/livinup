'use client'

import { useState } from 'react'
import { MediaImage } from '@/components/media/MediaImage'
import { cn } from '@/lib/utils/cn'
import type { PostImage } from '@/types/community'

/** A post's images, one at a time, with previous/next and dots. */
export function ImageCarousel({
  images,
  fallbackAlt,
}: {
  images: PostImage[]
  fallbackAlt: string
}) {
  const [index, setIndex] = useState(0)
  const image = images[index]
  if (!image) return null

  const go = (delta: number) => setIndex((value) => (value + delta + images.length) % images.length)

  return (
    <div
      className="bg-surface-sunken relative overflow-hidden rounded-2xl"
      aria-roledescription="carousel"
    >
      <div className="aspect-[4/5]">
        <MediaImage id={image.mediaId} alt={image.altText || fallbackAlt} priority={index === 0} />
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label="Previous photo"
            className="bg-surface/90 text-ink absolute top-1/2 left-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label="Next photo"
            className="bg-surface/90 text-ink absolute top-1/2 right-3 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full shadow"
          >
            ›
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((entry, position) => (
              <button
                key={entry.mediaId}
                type="button"
                onClick={() => setIndex(position)}
                aria-label={`Photo ${position + 1} of ${images.length}`}
                aria-current={position === index}
                className={cn(
                  'h-1.5 rounded-full transition-all',
                  position === index ? 'w-5 bg-white' : 'w-1.5 bg-white/60',
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
