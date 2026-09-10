import { SHOWCASE_MATCH, SHOWCASE_PREFERENCES } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * How a stated preference becomes a ranked result.
 *
 * Two panels rather than one: what the user said, and what LivinUp did with it.
 * The second panel is the honest half — it shows the preference that did *not*
 * match as well as the ones that did, because a personalisation feature that
 * only ever reports successes is one you cannot correct.
 */
export function PreferencePreview({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <div className="border-line bg-surface flex flex-col rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-subtle)]">
        <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">You said</p>
        <p className="text-ink mt-2 text-sm font-medium">Fit, style and colour</p>

        <ul className="mt-4 flex flex-wrap gap-2">
          {SHOWCASE_PREFERENCES.map((preference) => (
            <li
              key={`${preference.attribute}-${preference.value}`}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm',
                preference.selected
                  ? 'border-accent bg-accent-soft text-accent-strong font-medium'
                  : 'border-line-strong text-ink-muted',
              )}
            >
              {preference.value}
            </li>
          ))}
        </ul>

        <p className="text-ink-subtle mt-auto pt-4 text-xs leading-relaxed">
          Stated preferences always outrank anything LivinUp infers from your activity.
        </p>
      </div>

      <div className="border-line bg-surface rounded-[var(--radius-card)] border p-5 shadow-[var(--shadow-subtle)]">
        <div className="flex items-start justify-between gap-3">
          <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
            Why it ranked
          </p>
          <span className="text-ink-muted text-xs font-medium">{SHOWCASE_MATCH.percent} match</span>
        </div>

        <p className="text-ink mt-2 text-sm font-medium">{SHOWCASE_MATCH.product}</p>

        <p className="text-ink-subtle mt-4 text-xs font-medium tracking-wide uppercase">Matches</p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {SHOWCASE_MATCH.matched.map((value) => (
            <li
              key={value}
              className="bg-accent-soft text-accent-strong rounded-full px-2.5 py-1 text-xs font-medium"
            >
              {value}
            </li>
          ))}
        </ul>

        <p className="text-ink-subtle mt-4 text-xs font-medium tracking-wide uppercase">
          Does not match
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {SHOWCASE_MATCH.missed.map((value) => (
            <li
              key={value}
              className="border-line text-ink-subtle rounded-full border px-2.5 py-1 text-xs"
            >
              {value}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
