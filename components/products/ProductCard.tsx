import Link from 'next/link'
import type { ProductState } from '@/lib/engagement/repository'
import type { ProductSummary, RecommendedProduct } from '@/types/discovery'
import { humanize } from '@/lib/utils/format'
import { Card } from '@/components/ui/Card'
import { DealBadge } from './DealBadge'
import { PriceDisplay } from './PriceDisplay'
import { ProductActions } from './ProductActions'
import { ProductImage } from './ProductImage'

/**
 * A product card.
 *
 * The whole card is not a single link: the title is the link, and the action
 * buttons sit outside it. Nesting buttons inside an anchor is invalid HTML and
 * makes both keyboard and screen-reader interaction ambiguous. A stretched
 * pseudo-element gives the card a large click target while keeping exactly one
 * focusable link per card.
 *
 * Titles and match reasons are clamped to a fixed number of lines so that a
 * row of cards keeps a common baseline. Ragged card heights are the single
 * thing that makes a product grid look unfinished.
 */
export function ProductCard({
  item,
  state,
  priority = false,
}: {
  item: ProductSummary | RecommendedProduct
  state?: ProductState
  priority?: boolean
}) {
  const { product, offer, deal, offerCount } = item
  const explanations = 'explanations' in item ? item.explanations : []
  const outOfStock = offer.availability === 'out_of_stock' || offer.availability === 'discontinued'

  return (
    <Card
      as="article"
      className="group hover:border-line-strong relative flex w-full flex-col overflow-hidden transition-[border-color,box-shadow] duration-150 hover:shadow-[var(--shadow-raised)]"
    >
      <div className="bg-surface-sunken relative aspect-4/5 overflow-hidden">
        <ProductImage
          src={item.imageUrl}
          alt={`${product.brand} ${product.canonicalTitle}`}
          priority={priority}
        />

        {outOfStock && (
          <div className="bg-surface/75 absolute inset-0 flex items-center justify-center">
            <span className="border-line bg-surface text-ink-muted rounded-full border px-3 py-1 text-xs font-medium">
              Out of stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-ink-subtle text-[11px] font-medium tracking-wide uppercase">
          {product.brand}
        </p>

        {/* Two lines are reserved whether or not the title needs them, so the
            price sits on the same baseline in every card across a row. */}
        <h3 className="text-ink line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-medium">
          {/*
            Prefetch is off deliberately. Every card in the feed is a link, and
            the default viewport prefetch turned one scroll into a burst of
            background requests for /product/[id] — each one an authenticated
            dynamic render behind the proxy's session check. Production traces
            showed seven such requests inside a second from a single feed view.
            The route is dynamic and personalised, so a prefetched payload is
            mostly wasted work anyway; app/(app)/loading.tsx covers the wait.
          */}
          <Link
            href={`/product/${product.id}`}
            prefetch={false}
            className="after:absolute after:inset-0 after:content-['']"
          >
            {product.canonicalTitle}
          </Link>
        </h3>

        <PriceDisplay
          price={offer.currentPrice}
          originalPrice={offer.originalPrice}
          currency={offer.currency}
        />

        <div>
          <DealBadge deal={deal} />
        </div>

        {explanations.length > 0 && (
          <p className="text-ink-muted line-clamp-2 text-xs leading-relaxed">{explanations[0]}</p>
        )}

        <p className="text-ink-subtle mt-auto pt-1 text-xs">
          {offerCount > 1 ? `${offerCount} merchants` : offer.merchantName}
          {product.subcategory ? ` · ${humanize(product.subcategory)}` : ''}
        </p>
      </div>

      {state && (
        // z-10 lifts the controls above the card-wide stretched link overlay.
        <div className="border-line bg-surface-sunken/50 relative z-10 border-t px-3.5 py-2">
          <ProductActions
            productId={product.id}
            productTitle={`${product.brand} ${product.canonicalTitle}`}
            initialState={state}
            compact
          />
        </div>
      )}
    </Card>
  )
}
