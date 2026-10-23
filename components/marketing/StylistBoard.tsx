import { STYLIST_SPECIALISMS } from './showcase-data'

/**
 * The stylist marketplace, as a plan rather than a claim.
 *
 * No stylist has joined LivinUp, so there is nobody to show. These cards
 * therefore describe the kind of work a stylist would offer — a specialism, a
 * format, a scope — and carry no name, photograph, rating, review or
 * consultation count. Those are exactly the fields a visitor would read as
 * proof, and there is nothing yet to prove.
 *
 * The booking panel is drawn as an inert preview and labelled as one.
 */
export function StylistBoard() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
        {STYLIST_SPECIALISMS.map((stylist, index) => (
          <li
            key={stylist.id}
            className="lp-stylist lp-inview"
            style={{ transitionDelay: `${index * 70}ms` }}
          >
            <span className="lp-stylist-avatar" aria-hidden="true">
              <svg viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="20" cy="15" r="6.5" />
                <path d="M7.5 34c2-6.8 7-10 12.5-10s10.5 3.2 12.5 10" strokeLinecap="round" />
              </svg>
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[0.9375rem] font-medium tracking-tight">{stylist.focus}</p>
              <p className="mt-1 text-sm text-[#6b6460]">
                {stylist.mode} · {stylist.scope}
              </p>
            </div>
            <span className="lp-mini-btn shrink-0">Profile</span>
          </li>
        ))}
      </ul>

      <div className="lp-booking" aria-hidden="true">
        <p className="lp-eyebrow">Booking preview</p>
        <p className="mt-2.5 text-lg font-medium tracking-tight">A 45-minute styling session</p>
        <p className="mt-2 text-sm leading-relaxed text-[#6b6460]">
          A stylist sees the wardrobe you have already built, then works from it.
        </p>

        <ul className="mt-5 grid grid-cols-4 gap-1.5">
          {['Mon', 'Tue', 'Wed', 'Thu'].map((day, index) => (
            <li key={day} className={index === 1 ? 'lp-slot lp-slot-on' : 'lp-slot'}>
              <span className="block text-[0.6875rem] tracking-[0.1em] uppercase opacity-60">
                {day}
              </span>
              <span className="mt-1 block text-sm font-medium">
                {['14', '15', '16', '17'][index]}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-4 flex gap-2">
          <span className="lp-mini-btn lp-mini-btn-ink">Request a session</span>
          <span className="lp-mini-btn">Share wardrobe</span>
        </div>

        <p className="lp-illustration mt-5">
          Illustration · stylist booking is not live yet, and no stylist shown here is a real person
        </p>
      </div>
    </div>
  )
}
