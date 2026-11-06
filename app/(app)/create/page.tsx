import { z } from 'zod'
import { requireOnboardedUser } from '@/lib/auth'
import { listVerifiedBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { getOutfit, listItems, listAllItems } from '@/lib/wardrobe/repository'
import { PageContainer } from '@/components/layout/PageContainer'
import { PostComposer } from '@/components/create/PostComposer'
import type { WardrobeItem } from '@/types/wardrobe'

export const metadata = { title: 'Create a post' }

export default async function CreatePage({ searchParams }: PageProps<'/create'>) {
  const session = await requireOnboardedUser('/create')
  const params = await searchParams
  const outfitId =
    typeof params.outfit === 'string' && z.string().uuid().safeParse(params.outfit).success
      ? params.outfit
      : null

  const db = await getDb()
  const [outfit, items, everything, brands] = await Promise.all([
    outfitId ? getOutfit(db, session.id, outfitId) : Promise.resolve(null),
    listItems(db, session.id),
    listAllItems(db, session.id),
    listVerifiedBrands(db),
  ])
  const byId = new Map(everything.map((item) => [item.id, item]))
  const outfitItems = (outfit?.itemIds ?? [])
    .map((id) => byId.get(id))
    .filter((item): item is WardrobeItem => Boolean(item))

  return (
    <PageContainer>
      <h1 className="text-ink mb-6 text-2xl font-semibold tracking-tight">Create a post</h1>
      <PostComposer
        outfit={outfit}
        outfitItems={outfitItems}
        allPhotoItems={items.filter((item) => item.mediaId)}
        brands={brands
          .filter((brand) => brand.id !== session.id)
          .map((brand) => ({
            id: brand.id,
            displayName: brand.displayName,
            username: brand.username,
          }))}
        author={{
          displayName: session.profile.displayName,
          username: session.profile.username!,
          avatarMediaId: session.profile.avatarMediaId,
        }}
      />
    </PageContainer>
  )
}
