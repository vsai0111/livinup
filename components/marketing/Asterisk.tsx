/**
 * The brand mark.
 *
 * A six-armed asterisk used as punctuation inside display headlines and as the
 * compact nav mark. Drawn rather than typed so it keeps its weight next to
 * 112px type, where a font's own asterisk sits tiny and high on the line.
 */
export function Asterisk({
  className,
  color,
  weight = 2.4,
}: {
  className?: string
  color?: string
  /** Stroke width. Raise it for display sizes, where 2.4 reads as hairline. */
  weight?: number
}) {
  return (
    /*
      width/height give the glyph an intrinsic size, so a missing or unbuilt
      size class can never let it stretch to fill a flex parent. Any CSS
      dimension still overrides these.
    */
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      className={className}
      fill="none"
      stroke={color ?? 'currentColor'}
      strokeWidth={weight}
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 2.5v19M3.77 7.25l16.46 9.5M3.77 16.75l16.46-9.5" />
    </svg>
  )
}
