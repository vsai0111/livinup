import { SHOWCASE_OFFERS } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * Merchant comparison.
 *
 * Mirrors OfferList, including its restraint: the cheapest known offer is
 * marked "lowest we track", never "lowest price". LivinUp only sees the
 * merchants it has ingested, and a global claim from a partial view is false.
 */
export function OfferPreview({ className }: { className?: string }) {
  return (
    <ul
      aria-hidden="true"
      className={cn(
        'divide-line border-line bg-surface divide-y overflow-hidden rounded-[var(--radius-card)] border shadow-[var(--shadow-subtle)]',
        className,
      )}
    >
      {SHOWCASE_OFFERS.map((offer) => (
        <li
          key={offer.merchant}
          className={cn(
            'flex items-center justify-between gap-4 px-4 py-3.5',
            offer.best && 'bg-accent-soft/40',
          )}
        >
          <div className="min-w-0">
            <p className="text-ink text-sm font-medium">{offer.merchant}</p>
            <p className="text-ink-subtle text-xs">
              {offer.availability}
              {offer.best && ' · lowest we track'}
            </p>
          </div>
          <p className="text-ink text-sm font-semibold">{offer.price}</p>
        </li>
      ))}
    </ul>
  )
}
