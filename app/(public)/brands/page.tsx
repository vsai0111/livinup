import Link from 'next/link'
import { listVerifiedBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { displayHost } from '@/lib/utils/url'
import { plural } from '@/lib/utils/format'
import { PageContainer } from '@/components/layout/PageContainer'
import { VerifiedBadge } from '@/components/community/VerifiedBadge'
import { Avatar } from '@/components/ui/Avatar'

export const metadata = {
  title: 'Brands',
  description: 'Verified fashion brands on LivinUp.',
}

export default async function BrandsPage({ searchParams }: PageProps<'/brands'>) {
  const params = await searchParams
  const query = typeof params.q === 'string' ? params.q.slice(0, 60) : ''
  const db = await getDb()
  const brands = await listVerifiedBrands(db, { query })

  return (
    <PageContainer width="wide">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight">Brands</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Verified labels sharing their collections and how people wear them.
          </p>
        </div>
        <form action="/brands" method="get" role="search" className="w-full sm:w-72">
          <label htmlFor="brand-search" className="sr-only">
            Search brands
          </label>
          <input
            id="brand-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Search brands"
            className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle h-10 w-full rounded-lg border px-3 text-sm"
          />
        </form>
      </div>

      {brands.length === 0 ? (
        <div className="border-line mt-8 rounded-2xl border border-dashed px-6 py-16 text-center">
          <h2 className="text-ink text-lg font-semibold">
            {query ? `No brands match “${query}”` : 'Brands are joining soon'}
          </h2>
          <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Every brand on LivinUp is verified by our team before it appears here.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((brand) => (
            <li key={brand.id}>
              <Link
                href={`/u/${brand.username}?from=directory`}
                className="border-line bg-surface hover:border-line-strong flex h-full gap-4 rounded-2xl border p-5 transition-shadow hover:shadow-[var(--shadow-raised)]"
              >
                <Avatar name={brand.displayName} mediaId={brand.avatarMediaId} size="lg" />
                <div className="min-w-0">
                  <p className="text-ink flex items-center gap-1 font-semibold">
                    {brand.displayName}
                    <VerifiedBadge />
                  </p>
                  <p className="text-ink-subtle text-xs">
                    @{brand.username}
                    {brand.websiteUrl ? ` · ${displayHost(brand.websiteUrl)}` : ''}
                  </p>
                  {brand.bio && (
                    <p className="text-ink-muted mt-2 line-clamp-2 text-sm">{brand.bio}</p>
                  )}
                  <p className="text-ink-subtle mt-2 text-xs">{plural(brand.postCount, 'post')}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  )
}
