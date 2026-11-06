import { MediaImage } from '@/components/media/MediaImage'
import { cn } from '@/lib/utils/cn'

const SIZES = {
  xs: 'h-6 w-6 text-[10px]',
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl',
} as const

/** Deterministic, muted background per name, so initials avatars are distinguishable. */
const TINTS = ['#e8eefc', '#e7f3ec', '#fbeee6', '#f1eafb', '#e9f4f6', '#f8ecf1', '#f2f1e6']

function tintFor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return TINTS[hash % TINTS.length]
}

export function Avatar({
  name,
  mediaId,
  size = 'md',
  className,
}: {
  name: string
  mediaId?: string | null
  size?: keyof typeof SIZES
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      className={cn(
        'text-ink-muted ring-line relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1',
        SIZES[size],
        className,
      )}
      style={mediaId ? undefined : { backgroundColor: tintFor(name) }}
      aria-hidden="true"
    >
      {mediaId ? <MediaImage id={mediaId} size="sm" alt="" /> : initial}
    </span>
  )
}
