'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteOutfitAction, saveOutfitAction } from '@/app/(app)/outfits/actions'
import {
  OCCASIONS,
  OCCASION_LABELS,
  WARDROBE_LIMITS,
  ZONE_LABELS,
  ZONE_LIMITS,
  ZONES,
  wardrobeType,
  type Zone,
} from '@/config/wardrobe'
import { Button, ButtonLink } from '@/components/ui/Button'
import { ItemThumb } from '@/components/wardrobe/ItemThumb'
import { cn } from '@/lib/utils/cn'
import { arrangeByZone, toggleItem, zonesOf } from '@/lib/wardrobe/zones'
import type { Outfit, WardrobeItem } from '@/types/wardrobe'

/**
 * The outfit builder: a board of zones on one side, the wardrobe on the other.
 * Tapping a piece puts it on the board or takes it off. The zone rules live in
 * lib/wardrobe/zones.ts and are checked again on the server when saving.
 */

const PICKER_TABS: Array<{ id: Zone | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  ...ZONES.map((zone) => ({
    id: zone,
    label: zone === 'accessory' ? 'Accessories' : `${ZONE_LABELS[zone]}s`,
  })),
]

export function OutfitBuilder({
  items,
  outfit,
  initialItemIds = [],
}: {
  /** Every item the owner has, archived ones included (for existing outfits). */
  items: WardrobeItem[]
  outfit: Outfit | null
  initialItemIds?: string[]
}) {
  const router = useRouter()
  const byId = useMemo(() => new Map(items.map((item) => [item.id, item])), [items])
  const [placed, setPlaced] = useState<WardrobeItem[]>(() =>
    (outfit?.itemIds ?? initialItemIds)
      .map((id) => byId.get(id))
      .filter((item): item is WardrobeItem => Boolean(item)),
  )
  const [name, setName] = useState(outfit?.name ?? '')
  const [occasions, setOccasions] = useState<string[]>(outfit?.occasions ?? [])
  const [notes, setNotes] = useState(outfit?.notes ?? '')
  const [tab, setTab] = useState<Zone | 'all'>('all')
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pending, startTransition] = useTransition()

  const placedIds = new Set(placed.map((item) => item.id))
  const available = items.filter((item) => !item.archived || placedIds.has(item.id))
  const pickable = available.filter((item) => tab === 'all' || zonesOf(item.itemType)[0] === tab)
  const slots = arrangeByZone(placed)

  const toggle = (item: WardrobeItem) => {
    const result = toggleItem(placed, item)
    if (!result.ok) {
      setMessage({ tone: 'error', text: result.error })
      return
    }
    setPlaced(result.items)
    setMessage(
      result.replaced.length > 0
        ? {
            tone: 'ok',
            text: `Swapped out ${result.replaced.map((entry) => entry.name).join(' and ')}.`,
          }
        : null,
    )
  }

  const save = () => {
    if (placed.length === 0) {
      setMessage({ tone: 'error', text: 'Add at least one piece.' })
      return
    }
    const finalName = name.trim() || 'Untitled outfit'
    startTransition(async () => {
      const result = await saveOutfitAction(
        { name: finalName, occasions, notes, itemIds: placed.map((item) => item.id) },
        outfit?.id,
      )
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }
      setMessage({ tone: 'ok', text: 'Outfit saved.' })
      if (!outfit) router.replace(`/outfits/${result.data.id}`)
      else router.refresh()
    })
  }

  const remove = () =>
    startTransition(async () => {
      if (!outfit) return
      const result = await deleteOutfitAction(outfit.id)
      if (!result.ok) {
        setMessage({ tone: 'error', text: result.error })
        return
      }
      router.push('/outfits')
      router.refresh()
    })

  const canShare = Boolean(outfit) && placed.some((item) => item.mediaId)

  return (
    // `minmax(0,1fr)` on phones: an implicit grid column takes its items'
    // min-content width, so the zone tabs (meant to scroll sideways) would
    // otherwise widen the whole page past the screen.
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      {/* ---------------------------------------------------------- board -- */}
      <section aria-label="Outfit board" className="lg:sticky lg:top-6 lg:self-start">
        <div className="border-line bg-surface rounded-2xl border p-4 shadow-[var(--shadow-subtle)]">
          <div className="grid grid-cols-2 gap-3">
            {slots.map((slot) => {
              const limit = ZONE_LIMITS[slot.zone]
              const wide = slot.zone === 'accessory' || slot.zone === 'layer'
              return (
                <div key={slot.zone} className={cn(wide && 'col-span-2')}>
                  <p className="text-ink-subtle mb-1.5 flex items-center justify-between text-[11px] font-medium tracking-wide uppercase">
                    <span>{ZONE_LABELS[slot.zone]}</span>
                    {limit > 1 && (
                      <span className="tabular-nums">
                        {slot.items.length}/{limit}
                      </span>
                    )}
                  </p>
                  {slot.items.length === 0 ? (
                    <div
                      className={cn(
                        'border-line text-ink-subtle flex items-center justify-center rounded-xl border border-dashed text-xs',
                        wide ? 'h-20' : 'aspect-square',
                      )}
                    >
                      {slot.coveredBy ? `Covered by ${slot.coveredBy.name}` : 'Empty'}
                    </div>
                  ) : (
                    <ul
                      className={cn(
                        'grid gap-2',
                        wide ? 'grid-cols-4 sm:grid-cols-6' : 'grid-cols-1',
                      )}
                    >
                      {slot.items.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => toggle(item)}
                            className="group border-line relative block w-full overflow-hidden rounded-xl border"
                            aria-label={`Remove ${item.name}`}
                          >
                            <ItemThumb
                              item={item}
                              className={cn('w-full', wide ? 'aspect-square' : 'aspect-square')}
                            />
                            <span
                              className="bg-ink/70 text-primary-ink absolute top-1.5 right-1.5 hidden h-6 w-6 items-center justify-center rounded-full text-xs group-hover:flex group-focus-visible:flex"
                              aria-hidden="true"
                            >
                              ✕
                            </span>
                            {!wide && (
                              <span className="bg-surface/90 text-ink absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-xs font-medium">
                                {item.name}
                                {zonesOf(item.itemType).length > 1 && (
                                  <span className="text-ink-subtle">
                                    {' '}
                                    ·{' '}
                                    {zonesOf(item.itemType)
                                      .map((z) => ZONE_LABELS[z])
                                      .join(' + ')}
                                  </span>
                                )}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="outfit-name" className="text-ink block text-sm font-medium">
              Name
            </label>
            <input
              id="outfit-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={WARDROBE_LIMITS.outfitNameLength}
              placeholder="Sunday brunch"
              className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle h-11 w-full rounded-lg border px-3.5 text-sm"
            />
          </div>

          <fieldset>
            <legend className="text-ink text-sm font-medium">Occasions</legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {OCCASIONS.map((occasion) => {
                const on = occasions.includes(occasion)
                return (
                  <button
                    key={occasion}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setOccasions(
                        on ? occasions.filter((o) => o !== occasion) : [...occasions, occasion],
                      )
                    }
                    className={cn(
                      'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                      on
                        ? 'border-ink bg-ink text-primary-ink'
                        : 'border-line-strong text-ink-muted hover:text-ink',
                    )}
                  >
                    {OCCASION_LABELS[occasion]}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor="outfit-notes" className="text-ink block text-sm font-medium">
              Notes <span className="text-ink-subtle font-normal">· only you see these</span>
            </label>
            <textarea
              id="outfit-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              maxLength={WARDROBE_LIMITS.notesLength}
              rows={2}
              className="border-line-strong bg-surface text-ink w-full rounded-lg border px-3.5 py-2.5 text-sm"
            />
          </div>

          {message && (
            <p
              role={message.tone === 'error' ? 'alert' : 'status'}
              className={
                message.tone === 'error' ? 'text-negative text-sm' : 'text-ink-muted text-sm'
              }
            >
              {message.text}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} loading={pending && !confirmDelete}>
              {outfit ? 'Save changes' : 'Save outfit'}
            </Button>
            {canShare && (
              <ButtonLink href={`/create?outfit=${outfit!.id}`} variant="secondary">
                Share as post
              </ButtonLink>
            )}
            {outfit && (
              <div className="ml-auto flex items-center gap-2">
                {confirmDelete ? (
                  <>
                    <Button variant="danger" size="sm" onClick={remove} loading={pending}>
                      Delete outfit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancel
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- picker -- */}
      <section aria-label="Your pieces">
        <div
          className="border-line flex gap-1 overflow-x-auto border-b"
          role="tablist"
          aria-label="Zones"
        >
          {PICKER_TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              onClick={() => setTab(entry.id)}
              className={cn(
                '-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap',
                tab === entry.id
                  ? 'border-ink text-ink font-semibold'
                  : 'text-ink-muted hover:text-ink border-transparent font-medium',
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {available.length === 0 ? (
          <div className="border-line mt-6 rounded-xl border border-dashed p-8 text-center">
            <p className="text-ink-muted text-sm">
              Your wardrobe is empty, so there is nothing to put on yet.
            </p>
            <ButtonLink href="/wardrobe" className="mt-4" size="sm">
              Add pieces
            </ButtonLink>
          </div>
        ) : pickable.length === 0 ? (
          <p className="text-ink-muted mt-6 text-sm">
            No {tab === 'all' ? 'pieces' : ZONE_LABELS[tab as Zone].toLowerCase()} yet.{' '}
            <Link href="/wardrobe" className="text-ink underline underline-offset-2">
              Add some
            </Link>
          </p>
        ) : (
          <ul className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {pickable.map((item) => {
              const on = placedIds.has(item.id)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => toggle(item)}
                    aria-pressed={on}
                    className={cn(
                      'relative block w-full overflow-hidden rounded-xl border text-left transition-shadow',
                      on
                        ? 'border-accent ring-accent ring-2'
                        : 'border-line hover:border-line-strong hover:shadow-[var(--shadow-raised)]',
                    )}
                  >
                    <ItemThumb item={item} className="aspect-square w-full" />
                    <span className="block truncate px-2 py-1.5 text-xs font-medium">
                      {item.name}
                      <span className="text-ink-subtle block truncate font-normal">
                        {wardrobeType(item.itemType)?.label}
                        {item.archived ? ' · archived' : ''}
                      </span>
                    </span>
                    {on && (
                      <span
                        className="bg-accent text-accent-ink absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                        aria-hidden="true"
                      >
                        <svg
                          viewBox="0 0 12 12"
                          className="h-3 w-3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="m2 6.2 2.6 2.6L10 3.4" />
                        </svg>
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
