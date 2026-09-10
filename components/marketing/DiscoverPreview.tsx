import { ProductImage } from '@/components/products/ProductImage'
import { SHOWCASE_FEED, SHOWCASE_MATCH } from './showcase-data'
import { OfferPreview } from './OfferPreview'
import { cn } from '@/lib/utils/cn'

/**
 * What "a feed that explains itself" actually looks like.
 *
 * One product, then the two things the application says about it: why it was
 * ranked for you, and every merchant known to stock it. A merchant table on its
 * own does not illustrate the claim in the heading — the explanation is the
 * point, and it has to be the thing on screen.
 */
export function DiscoverPreview({ className }: { className?: string }) {
  const item = SHOWCASE_FEED[0]

  return (
    <div aria-hidden="true" className={cn('space-y-4', className)}>
      <div className="border-line bg-surface rounded-[var(--radius-card)] border p-4 shadow-[var(--shadow-subtle)]">
        <div className="flex gap-4">
          <div className="bg-surface-sunken relative aspect-4/5 w-24 shrink-0 overflow-hidden rounded-[var(--radius-control)]">
            <ProductImage src={`/api/product-image/${item.slug}`} alt="" sizes="96px" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">
              {item.brand}
            </p>
            <p className="text-ink mt-1 text-sm font-medium">{item.title}</p>

            <p className="mt-2 flex items-baseline gap-2">
              <span className="text-ink text-lg font-semibold">{item.price}</span>
              {item.wasPrice && (
                <span className="text-ink-subtle text-xs line-through">{item.wasPrice}</span>
              )}
            </p>

            <span className="text-deal-great border-deal-great/30 bg-deal-great/8 mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold">
              Great deal
            </span>
          </div>
        </div>

        <div className="border-line mt-4 border-t pt-4">
          <p className="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">
            Why this is in your feed
          </p>
          <ul className="mt-2 flex flex-wrap items-center gap-1.5">
            {SHOWCASE_MATCH.matched.map((value) => (
              <li
                key={value}
                className="bg-accent-soft text-accent-strong rounded-full px-2.5 py-1 text-xs font-medium"
              >
                {value}
              </li>
            ))}
            <li className="text-ink-subtle text-xs">{SHOWCASE_MATCH.percent} match</li>
          </ul>
        </div>
      </div>

      <div>
        <p className="text-ink-subtle mb-2 text-[11px] font-medium tracking-wide uppercase">
          Where you can buy it
        </p>
        <OfferPreview />
      </div>

      <p className="text-ink-subtle text-xs leading-relaxed">
        LivinUp compares the merchants it has ingested. It does not claim to know every price on the
        internet, so it never advertises one.
      </p>
    </div>
  )
}
