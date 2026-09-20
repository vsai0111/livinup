import { Asterisk } from './Asterisk'

/**
 * Infinite ticker.
 *
 * The item list is rendered twice and the track slides exactly -50%, so the
 * second copy lands where the first began and the loop is seamless. One copy
 * with a full-width translate visibly snaps.
 *
 * The duplicate is `aria-hidden`: a screen reader should hear the sentence
 * once, not twice, and should never hear it again as it loops.
 */
export function Marquee({
  items,
  tone = 'lime',
}: {
  items: readonly string[]
  tone?: 'lime' | 'plain'
}) {
  const group = (hidden: boolean) => (
    <div className="lp-marquee-group" aria-hidden={hidden || undefined}>
      {items.map((item, index) => (
        <span key={`${item}-${index}`} className="flex items-center gap-2.5 whitespace-nowrap">
          <Asterisk className="h-2.5 w-2.5 shrink-0 opacity-70" />
          <span className="lp-label" style={{ color: 'inherit' }}>
            {item}
          </span>
        </span>
      ))}
    </div>
  )

  return (
    <div className={tone === 'lime' ? 'lp-marquee' : 'lp-marquee lp-strip'}>
      <div className="lp-marquee-track">
        {group(false)}
        {group(true)}
      </div>
    </div>
  )
}
