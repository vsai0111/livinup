import { SHOWCASE_MATCH, SHOWCASE_PREFERENCES } from './showcase-data'
import { Note } from './Note'
import { cn } from '@/lib/utils/cn'

/**
 * Personalisation, as two facing panels: what you said, and what it did.
 *
 * The second panel shows the preference that did *not* match alongside the ones
 * that did. That asymmetry is the honest part of the feature and the reason the
 * section exists — a recommender that only ever reports its successes is one
 * you have no way to correct.
 */
export function PersonaBento() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* --- You said --- */}
      <div
        className="lp-inview relative overflow-hidden rounded-[1.5rem] p-7 sm:p-10"
        style={{ background: 'var(--lp-purple)', color: '#fff' }}
      >
        <p className="lp-label" style={{ color: 'rgba(255,255,255,0.7)' }}>
          You said
        </p>
        <p className="lp-display-sm mt-4 max-w-sm">Boxy, relaxed, olive, under $120.</p>

        <ul className="mt-8 flex flex-wrap gap-2" aria-hidden="true">
          {SHOWCASE_PREFERENCES.map((preference) => (
            <li
              key={`${preference.attribute}-${preference.value}`}
              className={cn(
                'rounded-full px-3.5 py-1.5 text-sm',
                preference.selected
                  ? 'bg-white font-medium text-[#3a1fb0]'
                  : 'text-white/70 ring-1 ring-white/30',
              )}
            >
              {preference.value}
            </li>
          ))}
        </ul>

        <p className="mt-8 max-w-sm text-sm leading-relaxed text-white/80">
          Every product is mapped onto the same vocabulary — fit, style, colour, material, brand,
          price band — so a shirt from one merchant can be compared with a shirt from another.
        </p>
      </div>

      {/* --- What LivinUp did --- */}
      <div
        className="lp-inview relative grid place-items-center overflow-hidden rounded-[1.5rem] px-6 py-14 sm:px-10"
        style={{ background: 'var(--lp-dark)' }}
      >
        {/* The oversized soft disc the reference uses to break the grid. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1/3 left-1/2 aspect-square w-[130%] -translate-x-1/2 rounded-full"
          style={{ background: '#1f1c1c' }}
        />

        <div className="relative w-full max-w-md">
          <div
            className="rounded-2xl p-5 sm:p-6"
            style={{ background: 'var(--lp-lime)', color: '#12240a' }}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="rounded bg-[#12240a] px-2 py-1 text-[10px] font-medium tracking-[0.12em] text-[#a1ff62] uppercase">
                Why it ranked
              </span>
              <span className="font-mono text-xs">{SHOWCASE_MATCH.percent} match</span>
            </div>

            <p className="mt-5 text-lg leading-tight font-medium">{SHOWCASE_MATCH.product}</p>

            <div className="mt-5 border-t border-[#12240a]/20 pt-4" aria-hidden="true">
              <p className="text-[10px] font-medium tracking-[0.12em] uppercase opacity-70">
                Matches
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {SHOWCASE_MATCH.matched.map((value) => (
                  <li
                    key={value}
                    className="rounded-full bg-[#12240a] px-2.5 py-1 text-xs font-medium text-[#a1ff62]"
                  >
                    {value}
                  </li>
                ))}
              </ul>

              <p className="mt-4 text-[10px] font-medium tracking-[0.12em] uppercase opacity-70">
                Does not match
              </p>
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {SHOWCASE_MATCH.missed.map((value) => (
                  <li
                    key={value}
                    className="rounded-full px-2.5 py-1 text-xs ring-1 ring-[#12240a]/30"
                  >
                    {value}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <Note tone="lime" flip className="mt-5 ml-2">
            It shows the misses too
          </Note>
        </div>
      </div>
    </div>
  )
}
