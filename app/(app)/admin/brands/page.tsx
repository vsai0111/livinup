import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { listAllBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { displayHost } from '@/lib/utils/url'
import { PageContainer } from '@/components/layout/PageContainer'
import { AdminNav } from '@/components/admin/AdminNav'
import { MakeBrandForm, VerifyBrand } from '@/components/admin/AdminControls'
import { Badge } from '@/components/ui/Badge'

export const metadata = { title: 'Admin · Brands', robots: { index: false } }

export default async function AdminBrandsPage() {
  await requireAdmin()
  const db = await getDb()
  const brands = await listAllBrands(db)

  return (
    <PageContainer width="wide">
      <h1 className="text-ink mb-4 text-2xl font-semibold tracking-tight">Admin</h1>
      <AdminNav current="brands" />

      <section className="border-line rounded-2xl border p-5">
        <h2 className="text-ink text-base font-semibold">Add a brand</h2>
        <p className="text-ink-muted mt-1 mb-4 text-sm">
          The brand signs up as a normal account first. Enter its username to convert it, then
          verify it once you have confirmed who runs it.
        </p>
        <MakeBrandForm />
      </section>

      <section className="mt-8">
        <h2 className="text-ink text-base font-semibold">Brand accounts</h2>
        {brands.length === 0 ? (
          <p className="text-ink-muted mt-2 text-sm">No brand accounts yet.</p>
        ) : (
          <ul className="border-line mt-3 divide-y divide-[var(--color-line)] rounded-2xl border">
            {brands.map((brand) => (
              <li
                key={brand.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-ink text-sm font-medium">
                    {brand.username ? (
                      <Link href={`/u/${brand.username}`} className="hover:underline">
                        {brand.displayName}
                      </Link>
                    ) : (
                      brand.displayName
                    )}{' '}
                    {brand.verified ? (
                      <Badge tone="positive">Verified</Badge>
                    ) : (
                      <Badge tone="warning">Unverified</Badge>
                    )}
                    {brand.status !== 'active' && <Badge tone="negative">{brand.status}</Badge>}
                  </p>
                  <p className="text-ink-subtle text-xs">
                    {brand.username ? `@${brand.username}` : 'No username yet'}
                    {brand.websiteUrl ? ` · ${displayHost(brand.websiteUrl)}` : ''}
                  </p>
                </div>
                <VerifyBrand profileId={brand.id} verified={brand.verified} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </PageContainer>
  )
}
