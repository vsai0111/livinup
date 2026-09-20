import { ProductImage } from '@/components/products/ProductImage'
import { APP_NAME, PRIMARY_NAV } from '@/config/app'
import { SHOWCASE_FEED } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * The application, shown as it actually looks.
 *
 * The surrounding band is dark; the product inside it is white, because the
 * signed-in product *is* white. Restyling the screenshot to match the marketing
 * page would make the landing page prettier and the first run after signup a
 * surprise, which is the one thing a product shot must never do.
 *
 * Inert throughout — no links, no controls — so it is hidden from assistive
 * technology and the section's own copy carries the meaning.
 */
export function AppShowcase() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[1.25rem] bg-white shadow-[0_50px_120px_-40px_rgba(0,0,0,0.6)]"
    >
      {/* App header */}
      <div className="flex items-center justify-between gap-4 border-b border-[#e9ebef] px-5 py-3.5">
        <span className="text-[0.9375rem] font-semibold tracking-tight text-[#0d1117]">
          {APP_NAME}
        </span>
        <nav className="hidden items-center gap-0.5 sm:flex">
          {PRIMARY_NAV.map((item, index) => (
            <span
              key={item.href}
              className={cn(
                'rounded-lg px-2.5 py-1.5 text-[0.8125rem]',
                index === 0
                  ? 'bg-[#f6f7f9] font-semibold text-[#0d1117]'
                  : 'font-medium text-[#566072]',
              )}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <span className="h-7 w-7 rounded-full bg-[#eef4f0] ring-1 ring-[#e9ebef]" />
      </div>

      {/* Page body */}
      <div className="px-5 py-6 sm:px-7">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-lg font-semibold tracking-tight text-[#0d1117]">Hello, Sara</p>
            <p className="mt-1 text-[0.8125rem] text-[#566072]">
              Ranked against 6 preferences. Adjust them any time.
            </p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <span className="rounded-lg border border-[#d8dce2] px-3 py-1.5 text-xs font-medium text-[#0d1117]">
              Search
            </span>
            <span className="rounded-lg border border-[#d8dce2] px-3 py-1.5 text-xs font-medium text-[#0d1117]">
              Preferences
            </span>
          </div>
        </div>

        <div className="mt-6 border-b border-[#e9ebef] pb-3">
          <p className="text-[0.9375rem] font-semibold tracking-tight text-[#0d1117]">
            Because you like boxy fits
          </p>
          <p className="mt-0.5 text-xs text-[#566072]">
            Ranked on your stated preferences and recorded price history.
          </p>
        </div>

        <ul className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SHOWCASE_FEED.map((item) => (
            <li
              key={item.slug}
              className="overflow-hidden rounded-xl border border-[#e9ebef] bg-white"
            >
              <div className="relative aspect-4/5 bg-[#f6f7f9]">
                <ProductImage src={`/api/product-image/${item.slug}`} alt="" sizes="220px" />
              </div>
              <div className="space-y-1.5 p-3">
                <p className="text-[10px] font-medium tracking-wide text-[#838d9e] uppercase">
                  {item.brand}
                </p>
                <p className="text-xs leading-snug font-medium text-[#0d1117]">{item.title}</p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-[#0d1117]">{item.price}</span>
                  {item.wasPrice && (
                    <span className="text-[10px] text-[#838d9e] line-through">{item.wasPrice}</span>
                  )}
                </p>
                <Band band={item.band} label={item.bandLabel} />
                {item.reason && (
                  <p className="line-clamp-2 text-[10px] leading-relaxed text-[#566072]">
                    {item.reason}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Mirrors DealBadge's central rule: with no price history there is no verdict,
 * and the badge says so rather than inventing one.
 */
function Band({ band, label }: { band: string | null; label?: string }) {
  if (!band) {
    return (
      <span className="inline-flex rounded-full border border-[#e9ebef] px-1.5 py-0.5 text-[10px] font-medium text-[#838d9e]">
        No price history yet
      </span>
    )
  }

  const tones: Record<string, string> = {
    excellent: 'text-[#1c6b45] border-[#1c6b45]/30 bg-[#1c6b45]/8',
    great: 'text-[#2b7a58] border-[#2b7a58]/30 bg-[#2b7a58]/8',
    good: 'text-[#5a7040] border-[#5a7040]/30 bg-[#5a7040]/8',
    fair: 'text-[#7a6a3c] border-[#7a6a3c]/30 bg-[#7a6a3c]/8',
    poor: 'text-[#7a5c50] border-[#7a5c50]/30 bg-[#7a5c50]/8',
  }

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        tones[band],
      )}
    >
      {label} deal
    </span>
  )
}
