import type { GarmentShape } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * A garment, drawn rather than photographed.
 *
 * The wardrobe and outfit mockups need to look like clothing, and the honest
 * options are a photograph of a real garment (we have none) or a drawing that
 * is plainly a drawing. These are the second.
 *
 * Each shape is a filled silhouette plus a few interior strokes. The fill is
 * what makes a grid of them read as a wardrobe: pure outlines at this size read
 * as a set of icons, and icons are the look of a software page, not a fashion
 * one. Both the fill and the stroke are ink at low alpha, so they tint with
 * whatever tone the tile is given rather than fighting it.
 *
 * Decorative by definition — the item's name is always printed next to the
 * tile — so the svg is hidden from assistive technology.
 */

interface Drawing {
  /** Closed outline, filled and stroked. */
  body: string
  /** Seams, plackets, collars. Stroked only. */
  detail?: string
}

const SHAPES: Record<GarmentShape, Drawing> = {
  shirt: {
    body: 'M35 18 50 26 65 18 75 22 80 30 77 62 68 60 68 86 32 86 32 60 23 62 20 30 25 22Z',
    detail: 'M35 18 50 26 65 18M50 28v58M21 56h8M71 56h8',
  },
  tee: {
    body: 'M37 19c5 7 21 7 26 0l11 5 5 16-10 4v40H31V44l-10-4 5-16Z',
    detail: 'M37 19c5 7 21 7 26 0M32 78h36',
  },
  knit: {
    body: 'M36 19c5 7 23 7 28 0l11 4 6 9-3 30-9-2v28H31V60l-9 2-3-30 6-9Z',
    detail: 'M36 19c5 7 23 7 28 0M31 79h38M22 57h9M69 57h9',
  },
  coat: {
    body: 'M34 16 50 27 66 16 78 21 84 30 80 68 70 66 70 94 30 94 30 66 20 68 16 30 22 21Z',
    detail: 'M34 16 46 46 50 27 54 46 66 16M50 46v48M31 64h38',
  },
  trousers: {
    body: 'M33 16h34l3 22-3 56H55l-5-46-5 46H33l-3-56Z',
    detail: 'M33 16h34M30 27h40M50 31v17',
  },
  skirt: {
    body: 'M35 17h30l4 17 7 56H24l7-56Z',
    detail: 'M35 17h30M31 34h38M43 36 40 90M50 36v54M57 36l3 54',
  },
  dress: {
    body: 'M39 15 50 23 61 15l7 7-5 24 11 48H26l11-48-5-24Z',
    detail: 'M39 15 50 23 61 15M33 48h34',
  },
  shoe: {
    body: 'M19 73l2-18c.5-7 6-9 13-5l12 9 24 2c8 .5 12 4 13 12Z',
    detail: 'M45 59c3 5 8 7 14 7M25 57l9 2',
  },
  bag: {
    body: 'M28 39h44l5 48H23Z',
    detail: 'M38 39c0-13 12-17 12-17s12 4 12 17',
  },
}

export function GarmentTile({
  shape,
  tone,
  className,
}: {
  shape: GarmentShape
  tone: string
  className?: string
}) {
  const drawing = SHAPES[shape]

  return (
    <div
      className={cn('lp-garment', className)}
      style={{ ['--tile' as string]: tone }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="lp-garment-art" focusable="false">
        <path
          d={drawing.body}
          fill="currentColor"
          fillOpacity="0.16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {drawing.detail && (
          <path
            d={drawing.detail}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
    </div>
  )
}
