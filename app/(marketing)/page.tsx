import { redirect } from 'next/navigation'
import Link from 'next/link'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { recordEvent } from '@/lib/analytics/events'
import { ensureSessionId } from '@/lib/analytics/session'
import { LandingNav } from '@/components/marketing/LandingNav'
import { LandingFooter } from '@/components/marketing/LandingFooter'
import { ScrollEffects } from '@/components/marketing/ScrollEffects'
import { Cursor } from '@/components/marketing/Cursor'
import { Marquee } from '@/components/marketing/Marquee'
import { Asterisk } from '@/components/marketing/Asterisk'
import { Note } from '@/components/marketing/Note'
import { HeroArc } from '@/components/marketing/HeroArc'
import { WardrobeShowcase } from '@/components/marketing/WardrobeShowcase'
import { OutfitStudio } from '@/components/marketing/OutfitStudio'
import { GapFinder } from '@/components/marketing/GapFinder'
import { BrandDiscovery } from '@/components/marketing/BrandDiscovery'
import { StylistBoard } from '@/components/marketing/StylistBoard'
import { JourneyFlow } from '@/components/marketing/JourneyFlow'
import '@/components/marketing/landing.css'

export const metadata = { title: `${APP_NAME} — ${APP_TAGLINE}` }

/**
 * Landing page.
 *
 * Signed-in visitors go straight to their feed; there is no reason to make
 * someone read a pitch for a product they already use.
 *
 * The page runs its own visual language, scoped under `.lp` (see landing.css)
 * so the signed-in product stays white-first and quiet.
 *
 * It introduces a product that is partly built and partly intended, so the
 * division is kept explicit rather than blurred. Signing up and setting style
 * preferences work today. The digital wardrobe, outfit generation, brand
 * profiles and stylist booking are drawn as mockups, every one of them labelled
 * as an illustration, and the copy says "will" where the product does not yet
 * do it. Nothing on this page is presented as a real brand, stylist, customer
 * or review.
 */
export default async function LandingPage() {
  const user = await getCurrentUser()
  if (user) redirect('/home')

  // First funnel step. Recorded server-side so it does not depend on a
  // third-party script loading, or on the visitor allowing it to.
  const sessionId = await ensureSessionId()
  const db = await getDb()
  await recordEvent(db, { eventType: 'landing_view', sessionId })

  return (
    <div className="lp">
      <Cursor />
      <ScrollEffects />
      <LandingNav />

      <main id="main">
        <Hero />
        <Ticker />
        <Statement />
        <WardrobeSection />
        <StylingSection />
        <GapSection />
        <BrandSection />
        <StylistSection />
        <JourneySection />
        <Finale />
      </main>

      <LandingFooter />
    </div>
  )
}

/* ------------------------------------------------------------------ Hero -- */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-0 sm:pt-40" aria-labelledby="hero">
      <div className="lp-rules" aria-hidden="true" />

      <div className="lp-shell relative">
        <h1 id="hero" className="lp-display text-center">
          <span className="lp-rise" style={{ ['--d' as string]: 0 }}>
            <span>Your wardrobe.</span>
          </span>
          <span className="lp-rise" style={{ ['--d' as string]: 1 }}>
            {/*
              Real spaces around the glyph, not just its margin. JSX drops the
              whitespace either side of an element on its own line, which left
              the heading announcing "Yourstyle." to a screen reader while
              looking correct on screen.
            */}
            <span>
              Your <Asterisk className="lp-hero-mark" color="var(--lp-clay)" weight={3.1} /> style.
            </span>
          </span>
          <span className="lp-rise" style={{ ['--d' as string]: 2 }}>
            <span>
              Your <em className="lp-em">next look</em>.
            </span>
          </span>
        </h1>

        <p
          className="lp-fade mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed sm:text-xl"
          style={{ ['--d' as string]: 4, color: 'var(--lp-ink-muted)' }}
        >
          Discover outfits from the clothes you already own, get personalised AI styling, and find
          the brands and pieces that fit your style.
        </p>

        <div
          className="lp-fade mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ ['--d' as string]: 5 }}
        >
          <Link href="/signup" className="lp-btn lp-btn-ink lp-magnet w-full sm:w-auto">
            Build my wardrobe
          </Link>
          <a href="#styling" className="lp-btn lp-btn-outline w-full sm:w-auto">
            Explore your style
          </a>
        </div>

        <p
          className="lp-fade mt-5 text-center"
          style={{ ['--d' as string]: 6, color: 'var(--lp-ink-faint)' }}
        >
          <span className="lp-label">
            Free to start · a few questions about your style, skip any of them
          </span>
        </p>
      </div>

      <HeroArc />
    </section>
  )
}

/* ---------------------------------------------------------------- Ticker -- */

const TICKER = [
  'Photograph what you own',
  'Outfits from your own clothes',
  'Styled for the occasion you pick',
  'Brands that match how you dress',
  'Human stylists, when you want one',
]

function Ticker() {
  return <Marquee items={TICKER} />
}

/* ------------------------------------------------------------- Statement -- */

function Statement() {
  return (
    <section className="lp-section" aria-labelledby="statement">
      <div className="lp-shell-narrow relative">
        <h2 id="statement" className="lp-statement lp-reveal text-center">
          Most of us own more than we wear. {APP_NAME} starts with the clothes already in your
          wardrobe — then suggests what to pair, what to add, and who to ask.
        </h2>

        <ol className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Upload what you own', 'Photograph your pieces. We help you tag and sort them.'],
            ['Tell us your taste', 'Fits, colours, occasions, roughly what you spend.'],
            ['Get looks, not lists', 'Combinations built from your own wardrobe first.'],
            ['Add only what is missing', 'Pieces that extend a look you already wear.'],
          ].map(([title, body], index) => (
            <li
              key={title}
              className="lp-inview"
              style={{ transitionDelay: `${index * 80}ms`, borderTop: '1px solid var(--lp-line)' }}
            >
              <p className="lp-label pt-5">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="mt-3 text-lg leading-tight font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-ink-muted)' }}>
                {body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- Wardrobe -- */

function WardrobeSection() {
  return (
    <section
      className="lp-section lp-section-divide"
      id="wardrobe"
      aria-labelledby="wardrobe-h"
      /* The eye needs to land on the mockup, so the type block stays narrow. */
    >
      <div className="lp-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="lp-head">
            <p className="lp-label lp-label-chip">Your digital wardrobe</p>
            <h2 id="wardrobe-h" className="lp-display-sm mt-5">
              Everything you own, in one place.
            </h2>
            <p className="lp-standfirst">
              Photograph your clothes and {APP_NAME} builds you a closet you can actually browse —
              sorted by category, colour and how often you reach for it. We suggest the tags and you
              correct them; no system reads a photograph perfectly.
            </p>
          </div>

          <Note className="hidden lg:inline-flex">You tag it, we learn it</Note>
        </div>

        <div className="lp-inview mt-12">
          <WardrobeShowcase />
        </div>

        <ul className="mt-14 grid gap-8 sm:grid-cols-3">
          {[
            [
              'Upload in batches',
              'A shelf at a time, from a phone. Re-shoot anything that is off.',
            ],
            ['Tags you can edit', 'Fit, colour, fabric and season — our guess, your final say.'],
            ['Yours to delete', 'Remove a piece, or the whole wardrobe, whenever you like.'],
          ].map(([title, body], index) => (
            <li key={title} className="lp-inview" style={{ transitionDelay: `${index * 80}ms` }}>
              <h3 className="text-base font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-ink-muted)' }}>
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Styling -- */

function StylingSection() {
  return (
    <section
      className="lp-section lp-dark relative overflow-hidden"
      id="styling"
      aria-labelledby="styling-h"
    >
      <div className="lp-shell relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="lp-head">
            <p className="lp-label lp-label-chip">AI styling</p>
            <h2 id="styling-h" className="lp-display-sm mt-5">
              An outfit for tonight, from the clothes in your room.
            </h2>
            <p className="lp-standfirst">
              Pick an occasion and {APP_NAME} assembles looks from pieces you already own, with a
              plain sentence explaining why the combination works. Save the ones you like, swap out
              a piece you do not.
            </p>
          </div>

          <Note tone="lime" className="hidden lg:inline-flex">
            Nothing new to buy
          </Note>
        </div>

        <div className="lp-inview mt-12">
          <OutfitStudio />
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Gaps -- */

function GapSection() {
  return (
    /* overflow-hidden: the dashed orbit is wider than the gutter allows on a
       phone, and a decorative ring is not worth a horizontal scrollbar. */
    <section className="lp-section relative overflow-hidden" id="gaps" aria-labelledby="gaps-h">
      <div className="lp-shell">
        <div className="relative grid place-items-center">
          <span className="lp-orbit" aria-hidden="true" />

          {/* Ghost words the centrepiece sits on top of. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between"
            aria-hidden="true"
          >
            <span className="lp-ghost">One</span>
            <span className="lp-ghost">piece</span>
          </div>

          <div className="relative z-10 w-full max-w-2xl text-center">
            <p className="lp-label lp-label-chip">Find what is missing</p>
            <h2 id="gaps-h" className="lp-display-sm mt-5">
              The one piece that finishes the look.
            </h2>
            <p
              className="mx-auto mt-5 max-w-lg text-base leading-relaxed"
              style={{ color: 'var(--lp-ink-muted)' }}
            >
              When a look is nearly there, {APP_NAME} will suggest what completes it — read against
              your wardrobe and your preferences, from the brands that have joined us.
            </p>
          </div>

          <div className="lp-inview relative z-10 mt-12 w-full">
            <GapFinder />
          </div>
        </div>

        <ul className="mt-20 grid gap-8 sm:grid-cols-3">
          {[
            ['Additions, not aisles', 'Every suggestion arrives attached to a look you can wear.'],
            ['Built on your taste', 'Your stated preferences, your wardrobe, your colours.'],
            [
              'An honest catalogue',
              'Only brands that partner with us. We do not claim to carry every shop.',
            ],
          ].map(([title, body], index) => (
            <li key={title} className="lp-inview" style={{ transitionDelay: `${index * 80}ms` }}>
              <h3 className="text-base font-medium tracking-tight">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--lp-ink-muted)' }}>
                {body}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Brands -- */

function BrandSection() {
  return (
    <section className="lp-section lp-section-divide" id="brands" aria-labelledby="brands-h">
      <div className="lp-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="lp-head">
            <p className="lp-label lp-label-chip">Brands and new launches</p>
            <h2 id="brands-h" className="lp-display-sm mt-5">
              The labels you have not met yet.
            </h2>
            <p className="lp-standfirst">
              Brands will have profiles on {APP_NAME} — their story, their collections, their
              launches, their photographs and films, and the pieces you can shop. You will discover
              them through what you already like, not through a category tree.
            </p>
          </div>
        </div>

        <div className="mt-12">
          <BrandDiscovery />
        </div>
      </div>
    </section>
  )
}

/* -------------------------------------------------------------- Stylists -- */

function StylistSection() {
  return (
    <section className="lp-section lp-section-divide" id="stylists" aria-labelledby="stylists-h">
      <div className="lp-shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="lp-head">
            <p className="lp-label lp-label-chip">Meet your stylist</p>
            <h2 id="stylists-h" className="lp-display-sm mt-5">
              When you would rather ask a person.
            </h2>
            <p className="lp-standfirst">
              We are building a place for independent stylists: their specialisms, their portfolio,
              and a consultation you can book. They will start from the wardrobe you have already
              uploaded, so the advice is about your clothes rather than a questionnaire.
            </p>
          </div>

          <Note className="hidden lg:inline-flex" flip>
            In development
          </Note>
        </div>

        <div className="mt-12">
          <StylistBoard />
        </div>
      </div>
    </section>
  )
}

/* --------------------------------------------------------------- Journey -- */

function JourneySection() {
  return (
    <section className="lp-section lp-dark" id="how" aria-labelledby="how-h">
      <div className="lp-shell">
        <div className="lp-head">
          <p className="lp-label lp-label-chip">The complete experience</p>
          <h2 id="how-h" className="lp-display-sm mt-5">
            One line, from your wardrobe to your next look.
          </h2>
          <p className="lp-standfirst">
            AI styling does the daily work; a human stylist steps in when the decision matters more.
            The point of all of it is to wear what you own more often — and to buy well when you do
            buy.
          </p>
        </div>

        <div className="mt-14">
          <JourneyFlow />
        </div>

        <dl className="lp-deflist mt-20" style={{ borderColor: 'var(--lp-line-dark)' }}>
          {[
            [
              'Fewer, better decisions',
              `${APP_NAME} is not here to sell you more clothes. Most of what it suggests is something already hanging in your wardrobe, and a recommendation only appears when a look genuinely needs it.`,
            ],
            [
              'Clear about what it knows',
              'Tags are suggestions you can correct, and a styling suggestion comes with the reason behind it. Anything we infer from your behaviour is visible to you and can be deleted.',
            ],
            [
              'Honest about what is built',
              'Accounts and style preferences work today. The wardrobe, outfit generation, brand profiles and stylist booking are in development, and every mockup on this page says so.',
            ],
          ].map(([title, body], index) => (
            <div
              key={title}
              className="lp-defrow lp-inview"
              style={{ transitionDelay: `${index * 70}ms`, borderColor: 'var(--lp-line-dark)' }}
            >
              <dt className="text-lg font-medium tracking-tight">{title}</dt>
              <dd
                className="text-base leading-relaxed"
                style={{ color: 'var(--lp-on-dark-muted)' }}
              >
                {body}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

/* ---------------------------------------------------------------- Finale -- */

function Finale() {
  return (
    <section className="relative overflow-hidden pt-24 pb-24 sm:pt-32" aria-labelledby="cta-h">
      <div className="lp-rules" aria-hidden="true" />

      <div className="lp-shell relative">
        {/* Words spread edge to edge, the way an editorial page closes. */}
        <h2
          id="cta-h"
          className="lp-display flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
        >
          <span>Start</span>
          <span>with</span>
          <span>what</span>
          <span className="lp-em">you own.</span>
        </h2>

        <div className="mt-16 flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <p
            className="max-w-md text-base leading-relaxed"
            style={{ color: 'var(--lp-ink-muted)' }}
          >
            Create an account and tell {APP_NAME} how you like to dress. You will be first in line
            as the wardrobe, styling and stylist features open up.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="lp-btn lp-btn-ink lp-magnet">
              Build my wardrobe
            </Link>
            <Link href="/signin" className="lp-btn lp-btn-outline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
