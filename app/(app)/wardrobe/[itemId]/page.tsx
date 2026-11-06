import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { wardrobeType } from '@/config/wardrobe'
import { requireOnboardedUser } from '@/lib/auth'
import { listVerifiedBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { getItem, outfitsUsingItem } from '@/lib/wardrobe/repository'
import { formatDate } from '@/lib/utils/format'
import { PageContainer } from '@/components/layout/PageContainer'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'
import { ItemDetail } from '@/components/wardrobe/ItemDetail'
import { ItemThumb } from '@/components/wardrobe/ItemThumb'

export const metadata = { title: 'Piece' }

export default async function ItemPage({ params }: PageProps<'/wardrobe/[itemId]'>) {
  const { itemId } = await params
  const session = await requireOnboardedUser(`/wardrobe/${encodeURIComponent(itemId)}`)
  // Someone else's id behaves exactly like a missing one.
  if (!z.string().uuid().safeParse(itemId).success) notFound()

  const db = await getDb()
  const item = await getItem(db, session.id, itemId)
  if (!item) notFound()
  const [outfits, brands] = await Promise.all([
    outfitsUsingItem(db, session.id, item.id),
    listVerifiedBrands(db),
  ])

  return (
    <PageContainer>
      <Link href="/wardrobe" className="text-ink-muted hover:text-ink text-sm font-medium">
        ← Wardrobe
      </Link>
      <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div>
          <ItemThumb
            item={item}
            size="md"
            className="border-line aspect-[4/5] w-full rounded-2xl border"
          />
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Badge>{wardrobeType(item.itemType)?.label ?? item.itemType}</Badge>
            {item.archived && <Badge tone="warning">Archived</Badge>}
            <span className="text-ink-subtle text-xs">Added {formatDate(item.createdAt)}</span>
          </div>

          <section className="mt-6">
            <h2 className="text-ink text-sm font-semibold">
              In {outfits.length === 1 ? '1 outfit' : `${outfits.length} outfits`}
            </h2>
            {outfits.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {outfits.map((outfit) => (
                  <li key={outfit.id}>
                    <Link
                      href={`/outfits/${outfit.id}`}
                      className="text-ink text-sm hover:underline"
                    >
                      {outfit.name}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-ink-muted mt-1 text-sm">Not in any outfit yet.</p>
            )}
            {!item.archived && (
              <ButtonLink
                href={`/outfits/new?with=${item.id}`}
                variant="secondary"
                size="sm"
                className="mt-3"
              >
                Build an outfit with this
              </ButtonLink>
            )}
          </section>
        </div>

        <div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight">{item.name}</h1>
          <div className="mt-6">
            <ItemDetail
              item={item}
              brands={brands.map((b) => ({ id: b.id, displayName: b.displayName }))}
            />
          </div>
        </div>
      </div>
    </PageContainer>
  )
}
