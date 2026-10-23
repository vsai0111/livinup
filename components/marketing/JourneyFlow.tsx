import { JOURNEY } from './showcase-data'

/**
 * The whole product in one line: wardrobe → styling → recommendations →
 * brands → shopping.
 *
 * A numbered list rather than a diagram, because the steps are read in order
 * and an SVG flow chart at this width becomes five words and a lot of arrows.
 * The connecting rule is drawn in CSS on the list itself.
 */
export function JourneyFlow() {
  return (
    <ol className="lp-journey">
      {JOURNEY.map(([title, body], index) => (
        <li
          key={title}
          className="lp-journey-step lp-inview"
          style={{ transitionDelay: `${index * 70}ms` }}
        >
          <span className="lp-journey-dot" aria-hidden="true" />
          <p className="lp-eyebrow">{String(index + 1).padStart(2, '0')}</p>
          <h3 className="mt-2 text-base leading-tight font-medium tracking-tight">{title}</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-on-dark-muted)' }}>
            {body}
          </p>
        </li>
      ))}
    </ol>
  )
}
