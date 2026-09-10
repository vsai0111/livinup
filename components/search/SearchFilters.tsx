import Link from 'next/link'
import { buildSearchHref } from '@/lib/search/query-params'
import { humanize } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Category } from '@/config/taxonomy'
import type { SearchFacetValue, SearchQuery } from '@/types/discovery'

/**
 * Faceted filters.
 *
 * Each facet value is a link that toggles itself in the query string, so
 * filtering needs no client JavaScript and every filtered view has its own URL.
 * Counts come from the same filtered result set, so a user never clicks a facet
 * that leads to zero results.
 *
 * On small screens the whole panel collapses into a <details> disclosure rather
 * than a custom drawer — native, keyboard-accessible, and no JavaScript.
 */
export function SearchFilters({
  query,
  facets,
  priceBounds,
}: {
  query: SearchQuery
  facets: { categories: SearchFacetValue[]; brands: SearchFacetValue[]; colors: SearchFacetValue[] }
  priceBounds: { min: number; max: number } | null
}) {
  const filters = query.filters ?? {}
  const hasFilters = Object.values(filters).some(
    (value) => value !== undefined && (!Array.isArray(value) || value.length > 0),
  )

  /** Toggle a single-valued filter on or off. */
  const categoryHref = (value: string) =>
    buildSearchHref(query, {
      page: 1,
      filters: {
        ...filters,
        category: filters.category === value ? undefined : (value as Category),
      },
    })

  /** Toggle one value within a multi-valued filter. */
  const multiHref = (key: 'brands' | 'colors', value: string) => {
    const current = filters[key] ?? []
    const next = current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]

    return buildSearchHref(query, {
      page: 1,
      filters: { ...filters, [key]: next.length > 0 ? next : undefined },
    })
  }

  return (
    /*
      Closed by default, and forced open from lg upwards by the
      `filters-disclosure` rule in globals.css. `open` as an attribute is
      all-or-nothing across breakpoints, and leaving it set meant a phone
      opened to a full screen of filters with the products pushed below the
      fold — the thing the disclosure exists to prevent.
    */
    <details className="filters-disclosure group border-line bg-surface rounded-[var(--radius-card)] border">
      <summary className="text-ink cursor-pointer list-none p-4 text-sm font-semibold">
        <span className="flex items-center justify-between">
          Filters
          <span className="text-ink-subtle text-xs font-normal" aria-hidden="true">
            <span className="group-open:hidden">Show</span>
            <span className="hidden group-open:inline">Hide</span>
          </span>
        </span>
      </summary>

      <div className="border-line space-y-6 border-t p-4 pt-5">
        {hasFilters && (
          <Link
            href={buildSearchHref({ text: query.text, sort: query.sort })}
            className="text-ink inline-block text-xs font-medium underline underline-offset-2"
          >
            Clear all filters
          </Link>
        )}

        <FacetGroup title="Category">
          {facets.categories.map((facet) => (
            <FacetLink
              key={facet.value}
              href={categoryHref(facet.value)}
              active={filters.category === facet.value}
              label={facet.label}
              count={facet.count}
            />
          ))}
        </FacetGroup>

        <FacetGroup title="Brand">
          {facets.brands.map((facet) => (
            <FacetLink
              key={facet.value}
              href={multiHref('brands', facet.value.toLowerCase())}
              active={(filters.brands ?? []).includes(facet.value.toLowerCase())}
              label={facet.label}
              count={facet.count}
            />
          ))}
        </FacetGroup>

        <FacetGroup title="Colour">
          {facets.colors.map((facet) => (
            <FacetLink
              key={facet.value}
              href={multiHref('colors', facet.value)}
              active={(filters.colors ?? []).includes(facet.value)}
              label={humanize(facet.label)}
              count={facet.count}
            />
          ))}
        </FacetGroup>

        {/* Price and discount need free input, so they are a small GET form. */}
        <form action="/search" method="get" className="space-y-3">
          {query.text && <input type="hidden" name="q" value={query.text} />}
          {query.sort && query.sort !== 'relevance' && (
            <input type="hidden" name="sort" value={query.sort} />
          )}
          {filters.category && <input type="hidden" name="category" value={filters.category} />}
          {filters.brands?.length ? (
            <input type="hidden" name="brand" value={filters.brands.join(',')} />
          ) : null}
          {filters.colors?.length ? (
            <input type="hidden" name="color" value={filters.colors.join(',')} />
          ) : null}

          <fieldset>
            <legend className="text-ink-subtle mb-2 text-xs font-medium tracking-wide uppercase">
              Price
            </legend>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label htmlFor="min-price" className="sr-only">
                  Minimum price
                </label>
                <input
                  id="min-price"
                  type="number"
                  name="min"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  placeholder={priceBounds ? String(Math.floor(priceBounds.min)) : 'Min'}
                  defaultValue={filters.minPrice ?? ''}
                  className="border-line-strong bg-surface text-ink h-10 w-full rounded-[var(--radius-control)] border px-2 text-sm"
                />
              </div>
              <span aria-hidden="true" className="text-ink-subtle">
                –
              </span>
              <div className="flex-1">
                <label htmlFor="max-price" className="sr-only">
                  Maximum price
                </label>
                <input
                  id="max-price"
                  type="number"
                  name="max"
                  min={0}
                  step="1"
                  inputMode="numeric"
                  placeholder={priceBounds ? String(Math.ceil(priceBounds.max)) : 'Max'}
                  defaultValue={filters.maxPrice ?? ''}
                  className="border-line-strong bg-surface text-ink h-10 w-full rounded-[var(--radius-control)] border px-2 text-sm"
                />
              </div>
            </div>
          </fieldset>

          <div>
            <label
              htmlFor="min-discount"
              className="text-ink-subtle mb-2 block text-xs font-medium tracking-wide uppercase"
            >
              Minimum discount
            </label>
            <select
              id="min-discount"
              name="discount"
              defaultValue={filters.minDiscount ?? ''}
              className="border-line-strong bg-surface text-ink h-10 w-full rounded-[var(--radius-control)] border px-2 text-sm"
            >
              <option value="">Any</option>
              <option value="10">10% or more</option>
              <option value="25">25% or more</option>
              <option value="40">40% or more</option>
              <option value="50">50% or more</option>
            </select>
          </div>

          <button
            type="submit"
            className="border-line-strong bg-surface text-ink hover:bg-surface-sunken h-10 w-full rounded-[var(--radius-control)] border text-sm font-medium"
          >
            Apply
          </button>
        </form>
      </div>
    </details>
  )
}

function FacetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children
  if (Array.isArray(items) && items.length === 0) return null

  return (
    <div>
      <h2 className="text-ink-subtle mb-2 text-xs font-medium tracking-wide uppercase">{title}</h2>
      <ul className="space-y-0.5">{children}</ul>
    </div>
  )
}

function FacetLink({
  href,
  active,
  label,
  count,
}: {
  href: string
  active: boolean
  label: string
  count: number
}) {
  return (
    <li>
      <Link
        href={href}
        aria-pressed={active}
        className={cn(
          'flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm',
          active
            ? 'bg-ink text-primary-ink font-medium'
            : 'text-ink-muted hover:bg-surface-sunken hover:text-ink',
        )}
      >
        <span className="truncate">{label}</span>
        <span className={cn('shrink-0 text-xs', active ? 'opacity-70' : 'text-ink-subtle')}>
          {count}
        </span>
      </Link>
    </li>
  )
}
