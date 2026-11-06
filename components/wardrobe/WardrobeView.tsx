'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { COLORS, GROUP_LABELS, ITEM_GROUPS, wardrobeType, type ItemGroup } from '@/config/wardrobe'
import { Button } from '@/components/ui/Button'
import { humanize } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { WardrobeItem } from '@/types/wardrobe'
import { AddPiecesDialog } from './AddPiecesDialog'
import { hexFor } from './GarmentIcon'
import type { BrandOption } from './ItemForm'
import { ItemThumb } from './ItemThumb'

type Tab = 'all' | ItemGroup | 'archived'

export function WardrobeView({
  items,
  archived,
  brands,
}: {
  items: WardrobeItem[]
  archived: WardrobeItem[]
  brands: BrandOption[]
}) {
  const [tab, setTab] = useState<Tab>('all')
  const [color, setColor] = useState<string>('')
  const [query, setQuery] = useState('')
  const [adding, setAdding] = useState<null | 'photos' | 'manual'>(null)

  const groupOf = (item: WardrobeItem) => wardrobeType(item.itemType)?.group
  const counts = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of items) {
      const group = groupOf(item)
      if (group) map.set(group, (map.get(group) ?? 0) + 1)
    }
    return map
  }, [items])

  const source = tab === 'archived' ? archived : items
  const term = query.trim().toLowerCase()
  const visible = source.filter((item) => {
    if (tab !== 'all' && tab !== 'archived' && groupOf(item) !== tab) return false
    if (color && item.color !== color && item.secondaryColor !== color) return false
    if (term && !`${item.name} ${item.brandText ?? ''}`.toLowerCase().includes(term)) return false
    return true
  })

  const colorsInUse = COLORS.filter((value) =>
    items.some((item) => item.color === value || item.secondaryColor === value),
  )

  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'all', label: 'All', count: items.length },
    ...ITEM_GROUPS.filter((group) => (counts.get(group) ?? 0) > 0).map((group) => ({
      id: group as Tab,
      label: GROUP_LABELS[group],
      count: counts.get(group) ?? 0,
    })),
    ...(archived.length > 0
      ? [{ id: 'archived' as Tab, label: 'Archived', count: archived.length }]
      : []),
  ]

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-ink text-2xl font-semibold tracking-tight">Wardrobe</h1>
          <p className="text-ink-muted mt-1 flex items-center gap-1.5 text-sm">
            <svg
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 1 1 8 0v3" />
            </svg>
            Only you can see your wardrobe.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setAdding('manual')}>
            Add without photo
          </Button>
          <Button onClick={() => setAdding('photos')}>Add pieces</Button>
        </div>
      </div>

      {items.length === 0 && archived.length === 0 ? (
        <div className="border-line mt-8 rounded-2xl border border-dashed px-6 py-16 text-center">
          <div className="bg-accent-soft text-accent-strong mx-auto flex h-12 w-12 items-center justify-center rounded-full">
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 6.5a2 2 0 1 1 3 1.73c-.62.36-1 .88-1 1.57v.7" />
              <path d="M12 10.5 3.6 16.9a1.5 1.5 0 0 0 .9 2.6h15a1.5 1.5 0 0 0 .9-2.6Z" />
            </svg>
          </div>
          <h2 className="text-ink mt-4 text-lg font-semibold">
            Start with five pieces you wear a lot
          </h2>
          <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            Photograph a few favourites: a top, a bottom, a pair of shoes. Once they are in, you can
            put them together into outfits.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => setAdding('photos')}>Add your first pieces</Button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="border-line mt-6 flex gap-1 overflow-x-auto border-b"
            role="tablist"
            aria-label="Categories"
          >
            {tabs.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
                className={cn(
                  '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors',
                  tab === entry.id
                    ? 'border-ink text-ink font-semibold'
                    : 'text-ink-muted hover:text-ink border-transparent font-medium',
                )}
              >
                {entry.label}
                <span className="text-ink-subtle ml-1.5 text-xs tabular-nums">{entry.count}</span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-0 flex-1 sm:max-w-xs">
              <span className="sr-only">Filter by name or brand</span>
              <svg
                viewBox="0 0 24 24"
                className="text-ink-subtle absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="6.5" />
                <path d="m16 16 4.5 4.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by name or brand"
                className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle h-10 w-full rounded-lg border pr-3 pl-9 text-sm"
              />
            </label>
            {colorsInUse.length > 1 && (
              <div className="flex items-center gap-1.5" role="group" aria-label="Filter by colour">
                {colorsInUse.map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setColor(color === value ? '' : value)}
                    aria-pressed={color === value}
                    title={humanize(value)}
                    className={cn(
                      'ring-line-strong h-6 w-6 rounded-full ring-1',
                      color === value && 'ring-ink ring-2 ring-offset-2',
                    )}
                    style={{
                      background:
                        value === 'multi'
                          ? 'conic-gradient(#c53b31, #e8c547, #3c6fc2, #3e8a50, #c53b31)'
                          : hexFor(value),
                    }}
                  >
                    <span className="sr-only">{humanize(value)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {visible.length === 0 ? (
            <p className="text-ink-muted mt-10 text-center text-sm">
              Nothing matches those filters.
            </p>
          ) : (
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {visible.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/wardrobe/${item.id}`}
                    className="group border-line bg-surface hover:border-line-strong block overflow-hidden rounded-xl border transition-shadow hover:shadow-[var(--shadow-raised)]"
                  >
                    <ItemThumb item={item} className="aspect-[4/5] w-full" />
                    <div className="px-3 py-2.5">
                      <p className="text-ink truncate text-sm font-medium">{item.name}</p>
                      <p className="text-ink-subtle truncate text-xs">
                        {[wardrobeType(item.itemType)?.label, item.brandText]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {adding && <AddPiecesDialog mode={adding} brands={brands} onClose={() => setAdding(null)} />}
    </div>
  )
}
