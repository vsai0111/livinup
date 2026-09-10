import { SelectField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import type { SearchQuery } from '@/types/discovery'

/**
 * Search input and sort control.
 *
 * A plain GET form: submitting navigates to /search?q=..., which keeps results
 * shareable and works with JavaScript disabled. Existing filters are preserved
 * as hidden inputs so searching does not silently discard them.
 */
export function SearchBar({ defaultValue, query }: { defaultValue: string; query: SearchQuery }) {
  const filters = query.filters ?? {}

  return (
    <form action="/search" method="get" role="search" className="flex flex-wrap items-end gap-2.5">
      {/* Preserve active filters across a new search. */}
      {filters.category && <input type="hidden" name="category" value={filters.category} />}
      {filters.brands?.length ? (
        <input type="hidden" name="brand" value={filters.brands.join(',')} />
      ) : null}
      {filters.colors?.length ? (
        <input type="hidden" name="color" value={filters.colors.join(',')} />
      ) : null}
      {filters.minPrice !== undefined && (
        <input type="hidden" name="min" value={filters.minPrice} />
      )}
      {filters.maxPrice !== undefined && (
        <input type="hidden" name="max" value={filters.maxPrice} />
      )}

      {/* Full width on a phone, where sharing a row with the sort control and
          the button left roughly 90px to type into. */}
      <div className="w-full min-w-0 sm:flex-1">
        <label htmlFor="search-input" className="sr-only">
          Search products
        </label>
        <input
          id="search-input"
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Search by product, brand or material"
          autoComplete="off"
          className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle hover:border-ink-subtle h-11 w-full rounded-[var(--radius-control)] border px-4 text-sm transition-colors"
        />
      </div>

      <div className="min-w-0 flex-1 sm:w-44 sm:flex-none">
        <SelectField
          label="Sort by"
          labelHidden
          name="sort"
          defaultValue={query.sort ?? 'relevance'}
          className="h-11 py-0"
        >
          <option value="relevance">Most relevant</option>
          <option value="deal_score">Best deal</option>
          <option value="discount">Biggest discount</option>
          <option value="price_asc">Price: low to high</option>
          <option value="price_desc">Price: high to low</option>
          <option value="newest">Newest</option>
        </SelectField>
      </div>

      <Button type="submit" className="shrink-0">
        Search
      </Button>
    </form>
  )
}
