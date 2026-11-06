import Link from 'next/link'
import { OCCASIONS, OCCASION_LABELS, type Occasion } from '@/config/wardrobe'
import { requireOnboardedUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { listAllItems, listOutfits } from '@/lib/wardrobe/repository'
import { formatRelativeTime, plural } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { PageContainer } from '@/components/layout/PageContainer'
import { ButtonLink } from '@/components/ui/Button'
import { OutfitCollage } from '@/components/outfits/OutfitCollage'
import type { WardrobeItem } from '@/types/wardrobe'

export const metadata = { title: 'Outfits' }

export default async function OutfitsPage({ searchParams }: PageProps<'/outfits'>) {
  const session = await requireOnboardedUser('/outfits')
  const params = await searchParams
  const occasion = OCCASIONS.includes(params.occasion as Occasion)
    ? (params.occasion as Occasion)
    : undefined

  const db = await getDb()
  const [outfits, items] = await Promise.all([
    listOutfits(db, session.id, { occasion }),
    listAllItems(db, session.id),
  ])
  const byId = new Map(items.map((item) => [item.id, item]))

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight">Outfits</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Looks you put together from your own wardrobe.
          </p>
        </div>
        <ButtonLink href="/outfits/new">New outfit</ButtonLink>
      </div>

      <nav aria-label="Filter by occasion" className="mt-6 flex flex-wrap gap-1.5">
        <Link
          href="/outfits"
          className={cn(
            'rounded-full border px-3 py-1.5 text-xs font-medium',
            !occasion
              ? 'border-ink bg-ink text-primary-ink'
              : 'border-line-strong text-ink-muted hover:text-ink',
          )}
        >
          All
        </Link>
        {OCCASIONS.map((value) => (
          <Link
            key={value}
            href={`/outfits?occasion=${value}`}
            aria-current={occasion === value ? 'page' : undefined}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium',
              occasion === value
                ? 'border-ink bg-ink text-primary-ink'
                : 'border-line-strong text-ink-muted hover:text-ink',
            )}
          >
            {OCCASION_LABELS[value]}
          </Link>
        ))}
      </nav>

      {outfits.length === 0 ? (
        <div className="border-line mt-8 rounded-2xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-ink text-lg font-semibold">
            {occasion
              ? `No ${OCCASION_LABELS[occasion].toLowerCase()} outfits yet`
              : 'No outfits yet'}
          </h2>
          <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            An outfit is a set of pieces from your wardrobe that you wear together. Save the ones
            that work, so you can reach for them again.
          </p>
          <ButtonLink href="/outfits/new" className="mt-6">
            Build an outfit
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {outfits.map((outfit) => {
            const pieces = outfit.itemIds
              .map((id) => byId.get(id))
              .filter((item): item is WardrobeItem => Boolean(item))
            return (
              <li key={outfit.id}>
                <Link
                  href={`/outfits/${outfit.id}`}
                  className="border-line bg-surface hover:border-line-strong block overflow-hidden rounded-xl border transition-shadow hover:shadow-[var(--shadow-raised)]"
                >
                  <OutfitCollage items={pieces} />
                  <div className="px-3 py-2.5">
                    <p className="text-ink truncate text-sm font-medium">{outfit.name}</p>
                    <p className="text-ink-subtle truncate text-xs">
                      {plural(pieces.length, 'piece')} · {formatRelativeTime(outfit.updatedAt)}
                    </p>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </PageContainer>
  )
}
