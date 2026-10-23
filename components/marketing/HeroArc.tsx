import { GarmentTile } from './GarmentTile'
import { WARDROBE_ITEMS } from './showcase-data'

/**
 * The fan of wardrobe cards beneath the hero.
 *
 * Laid out in CSS: every card shares one transform-origin far below the page,
 * and each is rotated `--i * --spread` degrees around it, which puts them on a
 * common arc. The whole fan then pivots by rotating a single parent as the page
 * scrolls, so seven cards cost one animated transform rather than seven.
 *
 * Entirely decorative — the pieces are illustrative, the cards are not links,
 * and the arc carries no information the sections below do not state plainly.
 * So it is hidden from assistive technology rather than described.
 */
export function HeroArc() {
  const cards = WARDROBE_ITEMS.slice(0, 7)
  const middle = (cards.length - 1) / 2

  return (
    <div className="lp-arc" aria-hidden="true">
      <div className="lp-arc-stage" style={{ ['--spread' as string]: '8.5deg' }}>
        {cards.map((card, index) => (
          <div key={card.id} className="lp-arc-card" style={{ ['--i' as string]: index - middle }}>
            <div className="lp-arc-inner">
              <GarmentTile shape={card.shape} tone={card.tone} className="lp-arc-shot" />
              <p className="lp-arc-caption">
                <span className="truncate font-medium">{card.name}</span>
                <span className="shrink-0 opacity-60">{card.category}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
