import Link from 'next/link'
import { notFound } from 'next/navigation'
import { z } from 'zod'
import { requireOnboardedUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { getOutfit, listAllItems } from '@/lib/wardrobe/repository'
import { PageContainer } from '@/components/layout/PageContainer'
import { OutfitBuilder } from '@/components/outfits/OutfitBuilder'

export const metadata = { title: 'Outfit' }

export default async function OutfitPage({ params }: PageProps<'/outfits/[id]'>) {
  const { id } = await params
  const session = await requireOnboardedUser(`/outfits/${encodeURIComponent(id)}`)
  if (!z.string().uuid().safeParse(id).success) notFound()

  const db = await getDb()
  const [outfit, items] = await Promise.all([
    getOutfit(db, session.id, id),
    listAllItems(db, session.id),
  ])
  if (!outfit) notFound()

  return (
    <PageContainer width="wide">
      <Link href="/outfits" className="text-ink-muted hover:text-ink text-sm font-medium">
        ← Outfits
      </Link>
      <h1 className="text-ink mt-3 mb-6 text-2xl font-semibold tracking-tight">{outfit.name}</h1>
      <OutfitBuilder items={items} outfit={outfit} />
    </PageContainer>
  )
}
