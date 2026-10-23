import { GarmentTile } from './GarmentTile'
import { BRAND_CARDS } from './showcase-data'

/**
 * Brand discovery, as an editorial shelf rather than a category page.
 *
 * No brand has a profile on LivinUp yet, so these cards describe disciplines
 * rather than businesses, and each carries a visible "illustration" label. A
 * placeholder that pretends to be a real label is the one thing this section
 * must not do: the reader would find out at the moment they clicked.
 */
export function BrandDiscovery() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {BRAND_CARDS.map((brand, index) => (
        <li
          key={brand.id}
          className="lp-brand lp-inview"
          style={{ transitionDelay: `${index * 70}ms` }}
        >
          <div className="lp-brand-art">
            <GarmentTile shape={brand.shape} tone={brand.tone} className="lp-garment-tall" />
            <span className="lp-brand-note">{brand.note}</span>
          </div>
          <div className="lp-brand-body">
            <p className="text-[0.9375rem] font-medium tracking-tight">{brand.name}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#6b6460]">{brand.discipline}</p>

            {/* The season's colours. A label is recognised by its palette long
                before its name, and four swatches say more about a collection
                than another line of copy would. */}
            <ul className="mt-3 flex gap-1" aria-hidden="true">
              {brand.palette.map((swatch) => (
                <li key={swatch} className="lp-swatch" style={{ background: swatch }} />
              ))}
            </ul>
            <p className="lp-illustration mt-4">Illustration · brand profiles in development</p>
          </div>
        </li>
      ))}
    </ul>
  )
}
