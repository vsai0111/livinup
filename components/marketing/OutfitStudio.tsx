import { GarmentTile } from './GarmentTile'
import { OCCASIONS, OUTFITS, WARDROBE_ITEMS } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * The core experience: a look built from clothes already in the wardrobe.
 *
 * Every piece in the composed outfit is one of the items from the wardrobe
 * mockup above, looked up by id, so the two sections cannot drift apart and
 * tell different stories about the same closet.
 *
 * Inert, so hidden from assistive technology; the surrounding copy states what
 * the feature does.
 */

const BY_ID = new Map(WARDROBE_ITEMS.map((item) => [item.id, item]))

export function OutfitStudio() {
  const [hero, ...rest] = OUTFITS
  // flatMap rather than map().filter(Boolean): the latter keeps `undefined` in
  // the element type, and every tile below would then need a non-null
  // assertion to compile.
  const pieces = hero.items.flatMap((id) => {
    const item = BY_ID.get(id)
    return item ? [item] : []
  })

  return (
    <div className="lp-panel" aria-hidden="true">
      <div className="lp-panel-bar">
        <span className="font-medium">Style me</span>
        <span className="lp-panel-dim">Using 48 pieces you own</span>
        <span className="lp-panel-pill">Regenerate</span>
      </div>

      <div className="p-5 sm:p-6">
        <ul className="flex flex-wrap gap-1.5">
          {OCCASIONS.map((occasion) => (
            <li
              key={occasion}
              className={cn(
                'rounded-full px-3 py-1.5 text-[0.8125rem]',
                occasion === hero.occasion
                  ? 'bg-[#1a1817] font-medium text-white'
                  : 'text-[#6b6460] ring-1 ring-[#e6e2dc]',
              )}
            >
              {occasion}
            </li>
          ))}
        </ul>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <div>
            <ul className="grid grid-cols-4 gap-2.5">
              {pieces.map((item) => (
                <li key={item.id} className="lp-item-card">
                  <GarmentTile shape={item.shape} tone={item.tone} />
                  <p className="lp-item-name">{item.name}</p>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-[0.8125rem] text-[#6b6460]">
              Four pieces, all already in your wardrobe.
            </p>
          </div>

          <div className="lp-why">
            <p className="lp-eyebrow">{hero.occasion} · look 1 of 6</p>
            <p className="mt-2.5 text-xl leading-tight font-medium tracking-tight">{hero.title}</p>
            <p className="mt-3 text-sm leading-relaxed text-[#4a4440]">{hero.why}</p>

            <ul className="mt-4 flex flex-wrap gap-1.5">
              {hero.tags.map((tag) => (
                <li key={tag} className="lp-chip">
                  {tag}
                </li>
              ))}
            </ul>

            <div className="mt-5 flex gap-2 border-t border-[#e6e2dc] pt-4">
              <span className="lp-mini-btn lp-mini-btn-ink">Save look</span>
              <span className="lp-mini-btn">Swap a piece</span>
            </div>
          </div>
        </div>

        <div className="mt-6 border-t border-[#ece8e2] pt-5">
          <p className="lp-eyebrow">Saved looks</p>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {rest.map((outfit) => (
              <li key={outfit.id} className="lp-saved">
                <div className="flex gap-1.5">
                  {outfit.items.map((id) => {
                    const item = BY_ID.get(id)
                    return item ? (
                      <GarmentTile
                        key={id}
                        shape={item.shape}
                        tone={item.tone}
                        className="lp-garment-sm"
                      />
                    ) : null
                  })}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{outfit.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[#6b6460]">
                    {outfit.occasion} · {outfit.items.length} pieces
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
