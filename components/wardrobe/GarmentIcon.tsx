import type { ReactNode } from 'react'
import { COLOR_HEX, wardrobeType, type Color, type GarmentShape } from '@/config/wardrobe'

/**
 * Line-drawn garment, filled with the item's colour. Shown for items added
 * without a photo, so they still read as clothing on the grid and the board.
 */

const OUTLINE = 'rgba(13, 17, 23, 0.45)'

export function hexFor(color: string): string {
  return COLOR_HEX[color as Color] ?? COLOR_HEX.grey
}

function mix(hex: string, amount: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  const target = amount > 0 ? 255 : 0
  const t = Math.min(1, Math.abs(amount))
  const channel = (c: number) => Math.round(c + (target - c) * t)
  return `#${[(value >> 16) & 255, (value >> 8) & 255, value & 255]
    .map((c) => channel(c).toString(16).padStart(2, '0'))
    .join('')}`
}

interface Paint {
  fill: string
  light: string
  dark: string
}

function Panel({ d, fill }: { d: string; fill: string }) {
  return <path d={d} fill={fill} stroke={OUTLINE} strokeWidth={1.3} strokeLinejoin="round" />
}

function Line({
  d,
  color,
  width = 1.2,
  opacity = 1,
}: {
  d: string
  color: string
  width?: number
  opacity?: number
}) {
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
    />
  )
}

const SHAPES: Record<GarmentShape, (p: Paint) => ReactNode> = {
  tee: (p) => (
    <>
      <Panel
        d="M20 14 L28 10 Q32 15 36 10 L44 14 L55 23 L48 31 L44 28 L44 55 L20 55 L20 28 L16 31 L9 23 Z"
        fill={p.fill}
      />
      <Line d="M28 10 Q32 17 36 10" color={p.dark} width={1.5} />
    </>
  ),
  shirt: (p) => (
    <>
      <Panel
        d="M20 12 L28 8 L32 14 L36 8 L44 12 L56 40 L50 43 L44 27 L44 56 L20 56 L20 27 L14 43 L8 40 Z"
        fill={p.fill}
      />
      <Panel d="M28 8 L32 14 L29 18 L25 10 Z" fill={p.light} />
      <Panel d="M36 8 L32 14 L35 18 L39 10 Z" fill={p.light} />
      <Line d="M32 15 L32 56" color={p.dark} />
    </>
  ),
  kurta: (p) => (
    <>
      <Panel
        d="M22 8 L28 6 L32 12 L36 6 L42 8 L54 34 L49 36 L43 22 L46 58 L18 58 L21 22 L15 36 L10 34 Z"
        fill={p.fill}
      />
      <Line d="M32 12 L32 26" color={p.dark} width={1.4} />
      <Line d="M18 54 L46 54" color={p.light} width={2} />
    </>
  ),
  knit: (p) => (
    <>
      <Panel
        d="M20 12 L28 9 Q32 13 36 9 L44 12 L56 40 L50 43 L44 27 L44 56 L20 56 L20 27 L14 43 L8 40 Z"
        fill={p.fill}
      />
      <Panel d="M20 50 L44 50 L44 56 L20 56 Z" fill={p.dark} />
      <Line d="M28 9 Q32 15 36 9" color={p.dark} width={2.4} />
    </>
  ),
  trousers: (p) => (
    <>
      <Panel d="M20 8 L44 8 L46 58 L35 58 L32 22 L29 58 L18 58 Z" fill={p.fill} />
      <Line d="M20 13 L44 13" color={p.dark} width={1.4} />
    </>
  ),
  jeans: (p) => (
    <>
      <Panel d="M20 8 L44 8 L46 58 L35 58 L32 22 L29 58 L18 58 Z" fill={p.fill} />
      <Line d="M20 13 L44 13" color={p.dark} width={1.4} />
      <Line d="M22 16 Q26 21 29 15 M42 16 Q38 21 35 15" color={p.light} width={1.2} />
    </>
  ),
  shorts: (p) => (
    <>
      <Panel d="M18 14 L46 14 L50 44 L35 46 L32 28 L29 46 L14 44 Z" fill={p.fill} />
      <Line d="M18 19 L46 19" color={p.dark} width={1.4} />
    </>
  ),
  skirt: (p) => (
    <>
      <Panel d="M22 12 L42 12 L52 54 L12 54 Z" fill={p.fill} />
      <Line d="M22 17 L42 17" color={p.dark} width={1.4} />
      <Line d="M28 18 L24 53 M36 18 L40 53" color={p.dark} opacity={0.6} />
    </>
  ),
  dress: (p) => (
    <>
      <Panel d="M24 6 L28 6 Q32 12 36 6 L40 6 L42 22 L54 58 L10 58 L22 22 Z" fill={p.fill} />
      <Line d="M22 22 Q32 25 42 22" color={p.dark} width={1.4} />
    </>
  ),
  saree: (p) => (
    <>
      <Panel d="M22 6 L42 6 L44 24 L50 58 L14 58 L20 24 Z" fill={p.fill} />
      <Panel d="M14 52 L50 52 L50 58 L14 58 Z" fill={p.light} />
      <Panel d="M40 6 L22 32 L18 27 L35 4 Z" fill={p.dark} />
    </>
  ),
  jacket: (p) => (
    <>
      <Panel
        d="M20 10 L30 8 L32 30 L34 8 L44 10 L56 46 L50 48 L44 28 L44 56 L34 56 L32 32 L30 56 L20 56 L20 28 L14 48 L8 46 Z"
        fill={p.fill}
      />
      <Panel d="M30 8 L26 22 L29 24 L32 14 Z" fill={p.dark} />
      <Panel d="M34 8 L38 22 L35 24 L32 14 Z" fill={p.dark} />
    </>
  ),
  coat: (p) => (
    <>
      <Panel
        d="M20 6 L30 4 L32 26 L34 4 L44 6 L56 44 L50 46 L45 26 L47 60 L34 60 L32 28 L30 60 L17 60 L19 26 L14 46 L8 44 Z"
        fill={p.fill}
      />
      <Panel d="M30 4 L26 18 L29 20 L32 10 Z" fill={p.dark} />
      <Panel d="M34 4 L38 18 L35 20 L32 10 Z" fill={p.dark} />
    </>
  ),
  sneaker: (p) => (
    <>
      <Panel d="M8 38 L20 36 Q26 28 34 32 L46 40 Q56 42 56 48 L56 52 L8 52 Z" fill={p.fill} />
      <Line d="M8 49 L56 49" color="#f5f4f0" width={3} />
      <Line d="M24 36 L30 33 M28 39 L34 36" color={p.dark} width={1.4} />
    </>
  ),
  boot: (p) => (
    <>
      <Panel d="M18 8 L32 8 L32 38 Q46 40 54 46 L54 54 L16 54 Z" fill={p.fill} />
      <Line d="M16 51 L54 51" color={p.dark} width={3} />
    </>
  ),
  sandal: (p) => (
    <>
      <Panel d="M10 46 Q32 40 54 46 L54 52 Q32 48 10 52 Z" fill={p.dark} />
      <Line d="M18 44 L28 30 L38 44" color={p.fill} width={4} />
      <Line d="M40 45 L46 36" color={p.fill} width={4} />
    </>
  ),
  'formal-shoe': (p) => (
    <>
      <Panel d="M6 44 Q14 34 28 36 Q42 38 52 42 Q58 44 58 50 L6 50 Z" fill={p.fill} />
      <ellipse cx="20" cy="40" rx="6" ry="2" fill={p.light} opacity={0.8} />
    </>
  ),
  bag: (p) => (
    <>
      <Line d="M22 25 Q22 10 32 10 Q42 10 42 25" color={p.dark} width={3} />
      <Panel d="M12 24 L52 24 L48 56 L16 56 Z" fill={p.fill} />
      <Panel d="M12 24 L52 24 L49 34 L15 34 Z" fill={p.dark} />
    </>
  ),
  belt: (p) => (
    <>
      <Panel d="M4 26 L60 26 L60 38 L4 38 Z" fill={p.fill} />
      <rect
        x="25"
        y="22.5"
        width="14"
        height="19"
        rx="2"
        fill="none"
        stroke={p.light}
        strokeWidth={2.4}
      />
    </>
  ),
  watch: (p) => (
    <>
      <Panel d="M24 4 L40 4 L40 60 L24 60 Z" fill={p.dark} />
      <circle cx="32" cy="32" r="13" fill={p.light} stroke={p.fill} strokeWidth={3} />
      <Line d="M32 32 L32 24 M32 32 L37 35" color={p.dark} width={1.6} />
    </>
  ),
  sunglasses: (p) => (
    <>
      <ellipse cx="20" cy="32" rx="11" ry="9" fill={p.fill} stroke={OUTLINE} strokeWidth={1.3} />
      <ellipse cx="44" cy="32" rx="11" ry="9" fill={p.fill} stroke={OUTLINE} strokeWidth={1.3} />
      <Line d="M30 30 Q32 26 34 30" color={p.dark} width={2} />
    </>
  ),
  scarf: (p) => (
    <>
      <Panel d="M18 10 Q32 22 46 10 L50 18 Q32 34 14 18 Z" fill={p.fill} />
      <Panel d="M36 26 L44 56 L34 56 L30 28 Z" fill={p.fill} />
      <Line d="M35 56 L35 61 M39 56 L39 61 M43 56 L43 61" color={p.dark} width={1.2} />
    </>
  ),
  jewellery: (p) => (
    <>
      <Line d="M14 12 Q32 46 50 12" color={p.fill} width={3} />
      <Panel d="M32 40 L37 46 L32 54 L27 46 Z" fill={p.fill} />
    </>
  ),
}

export function GarmentIcon({
  itemType,
  color,
  className,
}: {
  itemType: string
  color: string
  className?: string
}) {
  const shape = wardrobeType(itemType)?.shape ?? 'tee'
  const base = hexFor(color)
  const isMulti = color === 'multi'
  const patternId = `multi-${itemType}`
  const paint: Paint = {
    fill: isMulti ? `url(#${patternId})` : base,
    light: mix(base, 0.4),
    dark: mix(base, -0.32),
  }
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      {isMulti && (
        <defs>
          <pattern
            id={patternId}
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(35)"
          >
            <rect width="10" height="10" fill={COLOR_HEX.red} />
            <rect width="3.4" height="10" fill={COLOR_HEX.yellow} />
            <rect x="3.4" width="3.3" height="10" fill={COLOR_HEX.blue} />
          </pattern>
        </defs>
      )}
      {SHAPES[shape](paint)}
    </svg>
  )
}
