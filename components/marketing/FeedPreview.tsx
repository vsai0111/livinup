import { SHOWCASE_FEED } from './showcase-data'
import { ProductImage } from '@/components/products/ProductImage'
import { AppWindow } from './AppWindow'
import { cn } from '@/lib/utils/cn'

/**
 * The personalised feed, as it appears in the application.
 *
 * Deliberately a static rendering rather than the real ProductCard: the real
 * card carries save/like controls, and a control that cannot be operated is
 * worse than no control. Everything shown here is inert and decorative, so the
 * whole block is hidden from assistive technology and the surrounding copy
 * carries the meaning instead.
 */
export function FeedPreview({ className }: { className?: string }) {
  return (
    <AppWindow label="livinup.app / home" className={className}>
      <div aria-hidden="true" className="p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <p className="text-ink text-base font-semibold">Hello, Sara</p>
            <p className="text-ink-subtle mt-0.5 text-xs">Ranked against 6 preferences</p>
          </div>
          <span className="border-line text-ink-muted hidden rounded-full border px-2.5 py-1 text-[11px] font-medium sm:inline">
            Because you like boxy fits
          </span>
        </div>

        <ul className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {SHOWCASE_FEED.map((item) => (
            <li
              key={item.slug}
              className="border-line bg-surface overflow-hidden rounded-[var(--radius-control)] border"
            >
              <div className="bg-surface-sunken relative aspect-4/5">
                <ProductImage src={`/api/product-image/${item.slug}`} alt="" sizes="180px" />
              </div>
              <div className="space-y-1 p-2.5">
                <p className="text-ink-subtle text-[10px] font-medium tracking-wide uppercase">
                  {item.brand}
                </p>
                <p className="text-ink line-clamp-2 text-xs leading-snug font-medium">
                  {item.title}
                </p>
                <p className="flex items-baseline gap-1.5">
                  <span className="text-ink text-sm font-semibold">{item.price}</span>
                  {item.wasPrice && (
                    <span className="text-ink-subtle text-[10px] line-through">
                      {item.wasPrice}
                    </span>
                  )}
                </p>
                <MiniDealBadge band={item.band} label={item.bandLabel} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </AppWindow>
  )
}

/**
 * The deal badge at mockup scale.
 *
 * Mirrors DealBadge's most important rule: with no band there is no claim, and
 * the badge says the history is thin rather than inventing a verdict.
 */
function MiniDealBadge({ band, label }: { band: string | null; label?: string }) {
  if (!band) {
    return (
      <span className="border-line text-ink-subtle inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-medium">
        No price history yet
      </span>
    )
  }

  const styles: Record<string, string> = {
    excellent: 'text-deal-excellent border-deal-excellent/30 bg-deal-excellent/8',
    great: 'text-deal-great border-deal-great/30 bg-deal-great/8',
    good: 'text-deal-good border-deal-good/30 bg-deal-good/8',
    fair: 'text-deal-fair border-deal-fair/30 bg-deal-fair/8',
    poor: 'text-deal-poor border-deal-poor/30 bg-deal-poor/8',
  }

  return (
    <span
      className={cn(
        'inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
        styles[band],
      )}
    >
      {label} deal
    </span>
  )
}
