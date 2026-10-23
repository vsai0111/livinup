import { GarmentTile } from './GarmentTile'
import { WARDROBE_CATEGORIES, WARDROBE_ITEMS } from './showcase-data'
import { cn } from '@/lib/utils/cn'

/**
 * The digital closet, shown as the product would show it.
 *
 * The panel is white because the signed-in product is white: restyling the
 * mockup to match the marketing page would make this page prettier and the
 * first run after signup a surprise, which is the one thing a product shot must
 * never do.
 *
 * Inert throughout — no links, no controls — so it is hidden from assistive
 * technology and the section's own copy carries the meaning.
 */
export function WardrobeShowcase() {
  return (
    <div className="lp-panel" aria-hidden="true">
      <div className="lp-panel-bar">
        <span className="font-medium">My wardrobe</span>
        <span className="lp-panel-dim">48 pieces · 6 categories</span>
        <span className="lp-panel-pill">Add photos</span>
      </div>

      <div className="grid gap-5 p-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:p-6">
        <ul className="flex gap-1.5 overflow-hidden sm:flex-col">
          {WARDROBE_CATEGORIES.map((category) => (
            <li
              key={category.label}
              className={cn(
                'shrink-0 rounded-lg px-2.5 py-1.5 text-[0.8125rem] whitespace-nowrap',
                'active' in category && category.active
                  ? 'bg-[#f3f1ee] font-medium text-[#1a1817]'
                  : 'text-[#6b6460]',
              )}
            >
              {category.label}
            </li>
          ))}
        </ul>

        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {WARDROBE_ITEMS.map((item) => (
            <li key={item.id} className="lp-item-card">
              <GarmentTile shape={item.shape} tone={item.tone} />
              <p className="lp-item-name">{item.name}</p>
              <p className="lp-item-meta">{item.category}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="lp-panel-foot">
        <span>Photographed by you · tagged with your help</span>
        <span className="lp-panel-dim">10 of 48 shown</span>
      </div>
    </div>
  )
}
