import { requireOnboardedUser } from '@/lib/auth'
import { listVerifiedBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { listItems } from '@/lib/wardrobe/repository'
import { PageContainer } from '@/components/layout/PageContainer'
import { WardrobeView } from '@/components/wardrobe/WardrobeView'

export const metadata = { title: 'Wardrobe' }

export default async function WardrobePage() {
  const session = await requireOnboardedUser('/wardrobe')
  const db = await getDb()
  const [items, archived, brands] = await Promise.all([
    listItems(db, session.id),
    listItems(db, session.id, { archived: true }),
    listVerifiedBrands(db),
  ])

  return (
    <PageContainer width="wide">
      <WardrobeView
        items={items}
        archived={archived}
        brands={brands.map((brand) => ({ id: brand.id, displayName: brand.displayName }))}
      />
    </PageContainer>
  )
}
