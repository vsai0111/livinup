import { GarmentTile } from './GarmentTile'
import { GAP_SUGGESTIONS, OUTFITS, WARDROBE_ITEMS } from './showcase-data'

/**
 * Recommendations as additions to a look, never as a shopping aisle.
 *
 * The left column is the outfit the wardrobe already produces; the right is
 * what would extend it. Keeping them side by side is the whole point of the
 * section — a suggestion with no look attached to it is just an advert.
 *
 * Inert, so hidden from assistive technology.
 */

const BY_ID = new Map(WARDROBE_ITEMS.map((item) => [item.id, item]))

export function GapFinder() {
  const outfit = OUTFITS[0]
  const owned = outfit.items.slice(0, 3).flatMap((id) => {
    const item = BY_ID.get(id)
    return item ? [item] : []
  })

  return (
    <div className="lp-panel" aria-hidden="true">
      <div className="lp-panel-bar">
        <span className="font-medium">Complete the look</span>
        <span className="lp-panel-dim">{outfit.title}</span>
        <span className="lp-panel-pill">Your sizes</span>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div>
          <p className="lp-eyebrow">Already yours</p>
          <ul className="mt-3 grid grid-cols-3 gap-2.5">
            {owned.map((item) => (
              <li key={item.id} className="lp-item-card">
                <GarmentTile shape={item.shape} tone={item.tone} />
                <p className="lp-item-name">{item.name}</p>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative lg:border-l lg:border-[#ece8e2] lg:pl-6">
          <p className="lp-eyebrow">Would extend it</p>
          <ul className="mt-3 space-y-2.5">
            {GAP_SUGGESTIONS.map((suggestion) => (
              <li key={suggestion.id} className="lp-suggest">
                <GarmentTile
                  shape={suggestion.shape}
                  tone={suggestion.tone}
                  className="lp-garment-sm"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{suggestion.name}</p>
                  <p className="mt-0.5 text-xs text-[#6b6460]">{suggestion.role}</p>
                </div>
                <span className="lp-mini-btn shrink-0">View</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-[#8a827c]">
            Suggestions come from brands that have joined LivinUp — not from every shop on the
            internet.
          </p>
        </div>
      </div>
    </div>
  )
}
