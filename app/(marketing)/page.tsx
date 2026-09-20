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
import { AppShowcase } from '@/components/marketing/AppShowcase'
import { PersonaBento } from '@/components/marketing/PersonaBento'
import { PricePreview } from '@/components/marketing/PricePreview'
import '@/components/marketing/landing.css'

export const metadata = { title: `${APP_NAME} — ${APP_TAGLINE}` }

/**
 * Landing page.
 *
 * Signed-in visitors go straight to their feed; there is no reason to make
 * someone read a pitch for a product they already use.
 *
 * The page runs its own visual language, scoped under `.lp` (see landing.css)
 * so the signed-in product stays white-first and quiet. Every claim maps to
 * something the application computes; the mockups are static illustrations
 * built from showcase-data.ts, and they show the product's real white UI rather
 * than a restyled version of it.
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
        <FeedSection />
        <PriceSection />
        <PersonalizationSection />
        <WhySection />
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
            <span>Worth buying.</span>
          </span>
          <span className="lp-rise" style={{ ['--d' as string]: 1 }}>
            {/*
              Real spaces around the glyph, not just its margin. JSX drops the
              whitespace either side of an element on its own line, which left
              the heading announcing "Worthpaying." to a screen reader while
              looking correct on screen.
            */}
            <span>
              Worth{' '}
              <Asterisk className="lp-hero-mark" color="var(--lp-purple)" weight={3.1} />{' '}
              paying.
            </span>
          </span>
        </h1>

        <p
          className="lp-fade mx-auto mt-8 max-w-2xl text-center text-lg leading-relaxed sm:text-xl"
          style={{ ['--d' as string]: 3, color: 'var(--lp-ink-muted)' }}
        >
          Personalised discovery built on <span className="lp-token">recorded price history</span>,{' '}
          <span className="lp-token">deal scoring</span>,{' '}
          <span className="lp-token">preference matching</span> and{' '}
          <span className="lp-token">merchant comparison</span>.
        </p>

        <div
          className="lp-fade mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
          style={{ ['--d' as string]: 4 }}
        >
          <Link href="/signup" className="lp-btn lp-btn-lime lp-magnet w-full sm:w-auto">
            Get started — it&apos;s free
          </Link>
          <a href="#how" className="lp-btn lp-btn-outline w-full sm:w-auto">
            See how it works
          </a>
        </div>

        <p
          className="lp-fade mt-5 text-center"
          style={{ ['--d' as string]: 5, color: 'var(--lp-ink-faint)' }}
        >
          <span className="lp-label">A few questions to start · skip any of them</span>
        </p>
      </div>

      <HeroArc />
    </section>
  )
}

/* ---------------------------------------------------------------- Ticker -- */

const TICKER = [
  'Recorded price history, not marketing claims',
  'Five deal bands, reasoning shown',
  'Thin evidence? We say so',
  'Every merchant we track, side by side',
  'Preferences you can see and delete',
]

function Ticker() {
  return <Marquee items={TICKER} />
}

/* ------------------------------------------------------------- Statement -- */

function Statement() {
  return (
    <section className="lp-section" id="how" aria-labelledby="statement">
      <div className="lp-shell-narrow relative">
        <h2 id="statement" className="lp-statement lp-reveal text-center">
          {APP_NAME} learns what actually suits you, then scores every price against what that
          listing has genuinely cost over time. No black box, and no invented discounts.
        </h2>

        <ol className="mt-16 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Tell us what you like', 'Fits, colours, categories, roughly what you spend.'],
            ['It learns as you go', 'Saves, likes and dismissals keep sharpening the picture.'],
            ['Discover what matches', 'Every product shows which preferences it met.'],
            ['Buy at the right time', 'Scored against its own recorded price history.'],
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

/* ------------------------------------------------------------------ Feed -- */

function FeedSection() {
  return (
    <section
      className="lp-section lp-dark relative overflow-hidden"
      id="feed"
      aria-labelledby="feed-h"
    >
      <div className="lp-shell relative">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-xl">
            <p className="lp-label lp-label-chip">The product</p>
            <h2 id="feed-h" className="lp-display-sm mt-5">
              A feed that explains itself.
            </h2>
            <p
              className="mt-5 max-w-lg text-base leading-relaxed"
              style={{ color: 'var(--lp-on-dark-muted)' }}
            >
              Every card carries the reason it reached you, what the price has done over time, and
              the merchants that stock it. Nothing is ranked by a number you cannot see.
            </p>
          </div>

          <Note tone="lime" className="hidden lg:inline-flex">
            This is the real thing
          </Note>
        </div>

        <div className="lp-inview mt-12">
          <AppShowcase />
        </div>
      </div>
    </section>
  )
}

/* ----------------------------------------------------- Price intelligence -- */

function PriceSection() {
  return (
    <section className="lp-section relative overflow-hidden" id="price" aria-labelledby="price-h">
      <div className="lp-shell relative">
        <div className="relative grid place-items-center">
          <span className="lp-orbit" aria-hidden="true" />

          {/* Ghost words the centrepiece sits on top of. */}
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-1/2 items-center justify-between"
            aria-hidden="true"
          >
            <span className="lp-ghost">Good</span>
            <span className="lp-ghost">Price?</span>
          </div>

          <div className="relative z-10 w-full max-w-2xl text-center">
            <p className="lp-label lp-label-chip">Price intelligence</p>
            <h2 id="price-h" className="lp-display-sm mt-5">
              Is this actually a good price?
            </h2>
            <p
              className="mx-auto mt-5 max-w-md text-base leading-relaxed"
              style={{ color: 'var(--lp-ink-muted)' }}
            >
              Scored against the listing&apos;s own recorded history — never against a
              merchant&apos;s &ldquo;was&rdquo; price.
            </p>
          </div>

          <div className="lp-inview relative z-10 mt-10 w-full max-w-2xl">
            <PricePreview />
            <Note className="mt-4 ml-4" flip>
              Lowest we have ever recorded
            </Note>
          </div>
        </div>

        <ul className="mt-20 grid gap-8 sm:grid-cols-3">
          {[
            ['Current vs typical', 'The 30- and 90-day typical price, and the lowest ever seen.'],
            ['Five plain bands', 'Poor through Excellent, with the reasoning listed.'],
            ['Honest about gaps', 'Too little history and it says so instead of guessing.'],
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

/* ------------------------------------------------------- Personalization -- */

function PersonalizationSection() {
  return (
    <section className="lp-section" aria-labelledby="persona-h">
      <div className="lp-shell">
        <div className="mb-12 max-w-2xl">
          <p className="lp-label lp-label-chip">Personalisation</p>
          <h2 id="persona-h" className="lp-display-sm mt-5">
            Preferences you can actually see.
          </h2>
        </div>

        <PersonaBento />
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------- Why -- */

const REASONS = [
  [
    'Priced on evidence',
    'Every deal score comes from prices we have recorded for that exact listing. When there are too few to be sure, LivinUp says so rather than dressing a guess up as a verdict.',
  ],
  [
    'Ranked in the open',
    'Each product shows which of your preferences it met and which it missed, with the arithmetic available. Anything LivinUp infers from your behaviour is listed and can be deleted.',
  ],
  [
    'Honest about its limits',
    'It compares the merchants it has ingested and never claims to know every price on the internet. It earns a commission on some links, which changes neither your price nor the ranking.',
  ],
]

function WhySection() {
  return (
    <section className="lp-section" id="why" aria-labelledby="why-h">
      <div className="lp-shell">
        <div className="relative max-w-3xl">
          <h2 id="why-h" className="lp-display-sm">
            Built to be checked, not trusted blindly.
          </h2>
          <Note className="mt-4">Why {APP_NAME}?</Note>
        </div>

        <dl className="lp-deflist mt-14">
          {REASONS.map(([title, body], index) => (
            <div
              key={title}
              className="lp-defrow lp-inview"
              style={{ transitionDelay: `${index * 70}ms` }}
            >
              <dt className="text-lg font-medium tracking-tight">{title}</dt>
              <dd className="text-base leading-relaxed" style={{ color: 'var(--lp-ink-muted)' }}>
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
    <section
      className="lp-dark relative overflow-hidden pt-24 pb-20 sm:pt-32"
      aria-labelledby="cta-h"
    >
      <div className="lp-shell relative">
        {/* Words spread edge to edge, the way the reference closes its page. */}
        <h2
          id="cta-h"
          className="lp-display flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2"
        >
          <span>Level</span>
          <span>up</span>
          <span>your</span>
          <span>lifestyle.</span>
        </h2>

        <div className="mt-16 flex flex-col items-start justify-between gap-8 sm:flex-row sm:items-end">
          <p
            className="max-w-md text-base leading-relaxed"
            style={{ color: 'var(--lp-on-dark-muted)' }}
          >
            Tell {APP_NAME} what you like. We&apos;ll help you find what is worth your attention —
            and tell you when the price is worth paying.
          </p>

          <div className="flex flex-wrap gap-3">
            <Link href="/signup" className="lp-btn lp-btn-lime lp-magnet">
              Get started
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
