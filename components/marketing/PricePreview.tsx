import { SHOWCASE_PRICE } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * Price intelligence, as the product presents it.
 *
 * The chart is drawn from the same numbers quoted in the statistics below it,
 * so the visual and the figures cannot disagree — the mistake that makes a
 * marketing chart look invented. Built the way the real PriceHistoryChart is:
 * one inline polyline, no charting dependency.
 */
export function PricePreview({ className }: { className?: string }) {
  const { points, months, currency } = SHOWCASE_PRICE

  const width = 560
  const height = 180
  const pad = { top: 16, right: 12, bottom: 26, left: 12 }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const innerW = width - pad.left - pad.right
  const innerH = height - pad.top - pad.bottom

  const coords = points.map((price, i) => ({
    x: pad.left + (i / (points.length - 1)) * innerW,
    y: pad.top + innerH - ((price - min) / range) * innerH,
    price,
  }))

  const line = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const area = `${pad.left},${pad.top + innerH} ${line} ${(pad.left + innerW).toFixed(1)},${pad.top + innerH}`
  const latest = coords[coords.length - 1]

  return (
    <figure
      className={cn(
        'border-line bg-surface rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-subtle)] sm:p-6',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-ink text-sm font-semibold">{SHOWCASE_PRICE.product}</p>
          <p className="text-ink-subtle mt-0.5 text-xs">
            Price history at {SHOWCASE_PRICE.merchant}
          </p>
        </div>
        <span className="text-deal-excellent border-deal-excellent/30 bg-deal-excellent/8 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold">
          {SHOWCASE_PRICE.bandLabel} deal
          <span className="font-normal opacity-70">{SHOWCASE_PRICE.score}/100</span>
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-5 h-44 w-full"
        preserveAspectRatio="none"
        role="presentation"
        aria-hidden="true"
        focusable="false"
      >
        <polygon points={area} className="fill-accent/8" />
        <polyline
          points={line}
          fill="none"
          className="stroke-accent"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={latest.x} cy={latest.y} r="4" className="fill-accent-strong" />
      </svg>

      <p className="text-ink-subtle -mt-1 flex justify-between text-[11px]">
        <span>{months[0]}</span>
        <span>
          Low {currency}
          {min} · High {currency}
          {max}
        </span>
        <span>{months[months.length - 1]}</span>
      </p>

      <dl className="border-line mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t pt-4 sm:grid-cols-4">
        <Stat label="Current" value={SHOWCASE_PRICE.current} emphasis />
        <Stat label="30-day typical" value={SHOWCASE_PRICE.typical30} />
        <Stat label="90-day typical" value={SHOWCASE_PRICE.typical90} />
        <Stat label="Lowest seen" value={SHOWCASE_PRICE.lowest} />
      </dl>

      <ul className="mt-5 space-y-2">
        {SHOWCASE_PRICE.reasons.map((reason) => (
          <li key={reason.text} className="text-ink-muted flex gap-2.5 text-sm">
            <span
              aria-hidden="true"
              className={cn(
                'mt-0.5 font-semibold',
                reason.sentiment === 'positive' ? 'text-positive' : 'text-ink-subtle',
              )}
            >
              {reason.sentiment === 'positive' ? '↓' : '•'}
            </span>
            <span>{reason.text}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Stat({
  label,
  value,
  emphasis = false,
}: {
  label: string
  value: string
  emphasis?: boolean
}) {
  return (
    <div>
      <dt className="text-ink-subtle text-xs">{label}</dt>
      <dd className={cn('text-ink mt-0.5', emphasis ? 'font-semibold' : 'font-medium')}>{value}</dd>
    </div>
  )
}
