import Link from 'next/link'
import { requireOnboardedUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { listAllItems } from '@/lib/wardrobe/repository'
import { PageContainer } from '@/components/layout/PageContainer'
import { OutfitBuilder } from '@/components/outfits/OutfitBuilder'

export const metadata = { title: 'New outfit' }

export default async function NewOutfitPage({ searchParams }: PageProps<'/outfits/new'>) {
  const session = await requireOnboardedUser('/outfits/new')
  const params = await searchParams
  const db = await getDb()
  const items = await listAllItems(db, session.id)
  // `?with=<item>` starts the board with one piece, from the item page.
  const start =
    typeof params.with === 'string' &&
    items.some((item) => item.id === params.with && !item.archived)
      ? [params.with]
      : []

  return (
    <PageContainer width="wide">
      <Link href="/outfits" className="text-ink-muted hover:text-ink text-sm font-medium">
        ← Outfits
      </Link>
      <h1 className="text-ink mt-3 mb-6 text-2xl font-semibold tracking-tight">New outfit</h1>
      <OutfitBuilder items={items} outfit={null} initialItemIds={start} />
    </PageContainer>
  )
}
