import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { recordEvent } from '@/lib/analytics/events'
import { loadProductStates, recordProductView } from '@/lib/engagement/repository'
import { listActivePreferences } from '@/lib/preferences/repository'
import { loadProductDetail } from '@/lib/products/repository'
import { scoreProduct } from '@/lib/recommendations/scoring'
import { formatMoney, humanize } from '@/lib/utils/format'
import { Badge } from '@/components/ui/Badge'
import { DealBadge } from '@/components/products/DealBadge'
import { DealExplanation } from '@/components/products/DealExplanation'
import { PriceDisplay } from '@/components/products/PriceDisplay'
import { PriceHistoryChart } from '@/components/products/PriceHistoryChart'
import { ProductActions } from '@/components/products/ProductActions'
import { ProductImage } from '@/components/products/ProductImage'
import { PreferenceMatchPanel } from '@/components/products/PreferenceMatchPanel'
import { OfferList } from '@/components/products/OfferList'

const idSchema = z.string().uuid()

/**
 * Variants in the order a person expects to read them.
 *
 * Rows arrive in insertion order, which put shoe sizes on screen as
 * "10, 11, 12, 7, 8, 9" — correct data, presented as though nobody looked. This
 * only reorders what is displayed; it does not filter or alter any variant.
 */
const SIZE_ORDER = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'xxl', 'xxxl']

function sortSizes<T extends { size?: string | null }>(variants: readonly T[]): T[] {
  const rank = (variant: T) => {
    const raw = (variant.size ?? '').trim().toLowerCase()
    const numeric = Number(raw)
    // Numeric sizes first, in numeric order; then lettered sizes in the
    // conventional run; then anything unrecognised, alphabetically.
    if (raw !== '' && Number.isFinite(numeric)) return [0, numeric, ''] as const
    const index = SIZE_ORDER.indexOf(raw)
    return index === -1 ? ([2, 0, raw] as const) : ([1, index, ''] as const)
  }

  return [...variants].sort((a, b) => {
    const [groupA, valueA, textA] = rank(a)
    const [groupB, valueB, textB] = rank(b)
    return groupA - groupB || valueA - valueB || textA.localeCompare(textB)
  })
}

export async function generateMetadata({ params }: PageProps<'/product/[id]'>) {
  const { id } = await params
  if (!idSchema.safeParse(id).success) return { title: 'Product' }

  const db = await getDb()
  const detail = await loadProductDetail(db, id)
  if (!detail) return { title: 'Product not found' }

  return {
    title: `${detail.product.brand} ${detail.product.canonicalTitle}`,
    description: detail.product.description ?? undefined,
  }
}

export default async function ProductPage({ params }: PageProps<'/product/[id]'>) {
  const session = await requireUser()
  const { id } = await params

  // An id that is not a UUID never reaches the database.
  if (!idSchema.safeParse(id).success) notFound()

  const db = await getDb()
  const detail = await loadProductDetail(db, id)
  if (!detail) notFound()

  const [preferences, states] = await Promise.all([
    listActivePreferences(db, session.id),
    loadProductStates(db, session.id, [id]),
  ])

  const score = scoreProduct(detail, preferences)

  await Promise.all([
    recordEvent(db, {
      userId: session.id,
      eventType: 'product_viewed',
      productId: id,
      merchantProductId: detail.offer.id,
      metadata: { dealScore: detail.deal.score, matchScore: score.total },
    }),
    recordProductView(db, session.id, id),
  ])

  const { product, offer } = detail
  const attributes = Object.entries(product.attributes).filter(([, value]) => Boolean(value))
  const sizes = sortSizes(detail.variants.filter((variant) => variant.size))

  return (
    <article className="space-y-12">
      {/* --- Above the fold: what is it, what does it cost, where do I get it --- */}
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="border-line bg-surface-sunken relative aspect-4/5 overflow-hidden rounded-[var(--radius-card)] border">
            <ProductImage
              src={detail.imageUrl}
              alt={`${product.brand} ${product.canonicalTitle}`}
              sizes="(max-width: 1024px) 100vw, 50vw"
              priority
            />
          </div>
        </div>

        <div className="min-w-0">
          <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
            {product.brand}
          </p>
          <h1 className="text-ink mt-2 text-2xl font-semibold text-balance sm:text-3xl">
            {product.canonicalTitle}
          </h1>

          {/* Price and its verdict together — the deal band is a claim about
              this number, so separating them makes the reader do the joining. */}
          <div className="border-line mt-5 rounded-[var(--radius-card)] border p-5">
            <PriceDisplay
              price={offer.currentPrice}
              originalPrice={offer.originalPrice}
              currency={offer.currency}
              size="lg"
            />
            <p className="text-ink-muted mt-1.5 text-sm">
              at {offer.merchantName}
              {detail.offerCount > 1 && ` · ${detail.offerCount} merchants stock this`}
            </p>
            <div className="mt-3.5">
              <DealBadge deal={detail.deal} showScore={!detail.deal.limitedEvidence} />
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            {/*
              A plain link, not a fetch: it must be middle-clickable and
              openable in a new tab like any other outbound link. The route
              records the click, then redirects.
            */}
            <a
              href={`/go/${offer.id}`}
              rel="nofollow sponsored noopener"
              target="_blank"
              className="bg-primary text-primary-ink hover:bg-primary-strong inline-flex h-12 items-center justify-center rounded-[var(--radius-control)] px-6 text-[0.9375rem] font-medium shadow-[var(--shadow-subtle)] transition-colors"
            >
              Buy at {offer.merchantName}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>

            <ProductActions
              productId={product.id}
              productTitle={`${product.brand} ${product.canonicalTitle}`}
              initialState={
                states.get(product.id) ?? { saved: false, liked: false, rejected: false }
              }
            />
          </div>

          <p className="text-ink-subtle mt-3 text-xs leading-relaxed">
            LivinUp may earn a commission on purchases made through this link. It does not change
            the price you pay or how this product was ranked.
          </p>

          {product.description && (
            <p className="text-ink-muted border-line mt-6 border-t pt-6 text-sm leading-relaxed">
              {product.description}
            </p>
          )}

          {sizes.length > 0 && (
            <div className="border-line mt-6 border-t pt-6">
              <h2 className="text-ink text-sm font-semibold">Available sizes</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {sizes.map((variant) => (
                  <li
                    key={variant.id}
                    className="border-line-strong text-ink-muted min-w-11 rounded-[var(--radius-control)] border px-3 py-1.5 text-center text-xs font-medium"
                  >
                    {variant.size}
                  </li>
                ))}
              </ul>
              <p className="text-ink-subtle mt-2.5 text-xs">
                Size availability is confirmed on the merchant&apos;s own page.
              </p>
            </div>
          )}

          {attributes.length > 0 && (
            <div className="border-line mt-6 border-t pt-6">
              <h2 className="text-ink text-sm font-semibold">Details</h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {attributes.map(([key, value]) => (
                  <li key={key}>
                    <Badge>
                      <span className="text-ink-subtle">{humanize(key)}:</span> {humanize(value!)}
                    </Badge>
                  </li>
                ))}
                {product.subcategory && (
                  <li>
                    <Badge>{humanize(product.subcategory)}</Badge>
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* --- Is it a good price, and why is it here --- */}
      <div className="grid gap-5 lg:grid-cols-2">
        <DealExplanation deal={detail.deal} />
        <PreferenceMatchPanel score={score} hasPreferences={preferences.length > 0} />
      </div>

      <section
        aria-labelledby="history-heading"
        className="border-line bg-surface rounded-[var(--radius-card)] border p-5 sm:p-6"
      >
        <h2 id="history-heading" className="text-ink text-base font-semibold">
          Price history at {offer.merchantName}
        </h2>
        <p className="text-ink-muted mt-1 text-sm leading-relaxed">
          Every price we have recorded for this listing. Currently{' '}
          {formatMoney(offer.currentPrice, offer.currency)}.
        </p>
        <div className="mt-5">
          <PriceHistoryChart points={detail.priceHistory} currency={offer.currency} />
        </div>
      </section>

      {detail.offers.length > 1 && (
        <section aria-labelledby="offers-heading">
          <h2 id="offers-heading" className="text-ink text-base font-semibold">
            Where you can buy it
          </h2>
          <p className="text-ink-muted mt-1 text-sm leading-relaxed">
            All merchants we know stock this product, cheapest available first.
          </p>
          <div className="mt-4">
            <OfferList offers={detail.offers} highlightId={offer.id} />
          </div>
        </section>
      )}
    </article>
  )
}
