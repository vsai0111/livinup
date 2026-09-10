import { redirect } from 'next/navigation'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { recordEvent } from '@/lib/analytics/events'
import { ensureSessionId } from '@/lib/analytics/session'
import { ButtonLink } from '@/components/ui/Button'
import { Container } from '@/components/ui/Container'
import { Section, SectionHeading } from '@/components/ui/Section'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { MarketingFooter } from '@/components/marketing/MarketingFooter'
import { FeedPreview } from '@/components/marketing/FeedPreview'
import { PricePreview } from '@/components/marketing/PricePreview'
import { PreferencePreview } from '@/components/marketing/PreferencePreview'
import { DiscoverPreview } from '@/components/marketing/DiscoverPreview'

export const metadata = { title: `${APP_NAME} — ${APP_TAGLINE}` }

/**
 * Landing page.
 *
 * Signed-in visitors go straight to their feed; there is no reason to make
 * someone read a pitch for a product they already use.
 *
 * Every claim below describes something the application actually does. The
 * mockups are static — see components/marketing/showcase-data.ts — but the
 * fields they show (deal bands, 30/90-day typical prices, preference match
 * percentages, merchant offers) are all real outputs of the product.
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
    <>
      <MarketingNav />

      <main id="main" className="flex-1">
        <Hero />
        <ValueStrip />
        <HowItWorks />
        <Discover />
        <Personalization />
        <PriceIntelligence />
        <FinalCta />
      </main>

      <MarketingFooter />
    </>
  )
}

/* ------------------------------------------------------------------ Hero -- */

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className="pt-14 pb-16 sm:pt-20 sm:pb-24">
      <Container>
        <div className="mx-auto max-w-3xl text-center">
          <p className="border-line text-ink-muted inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <span className="bg-accent h-1.5 w-1.5 rounded-full" aria-hidden="true" />
            Personalized discovery with real price history
          </p>

          <h1
            id="hero-heading"
            className="text-ink mt-6 text-4xl leading-[1.08] font-semibold text-balance sm:text-5xl lg:text-6xl"
          >
            Find products that actually fit your life.
          </h1>

          <p className="text-ink-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty">
            {APP_NAME} learns what you like, then shows you what is worth buying — and whether
            today&apos;s price is genuinely worth paying, based on prices we have actually recorded.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <ButtonLink href="/signup" size="lg" className="w-full sm:w-auto">
              Get started
            </ButtonLink>
            <ButtonLink
              href="#how-it-works"
              variant="secondary"
              size="lg"
              className="w-full sm:w-auto"
            >
              See how it works
            </ButtonLink>
          </div>

          <p className="text-ink-subtle mt-4 text-xs">
            Free to use. A few questions to start — skip any of them.
          </p>
        </div>

        <FeedPreview className="mt-14 sm:mt-16" />
      </Container>
    </section>
  )
}

/* ----------------------------------------------------------- Value strip -- */

const VALUES = [
  {
    title: 'Personalized',
    body: 'Tell LivinUp what you like and every recommendation is ranked against it — and shows you which preferences it met.',
  },
  {
    title: 'Price intelligence',
    body: 'Compare the price today against what a listing has actually cost over time, not against a marketing “was” price.',
  },
  {
    title: 'Less noise',
    body: 'One feed instead of ten tabs. Products that do not fit what you told us are ranked down, not padded in.',
  },
]

function ValueStrip() {
  return (
    <section aria-labelledby="values-heading" className="border-line border-y">
      <Container>
        <h2 id="values-heading" className="sr-only">
          Why {APP_NAME}
        </h2>
        <ul className="divide-line grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {VALUES.map((value) => (
            <li key={value.title} className="py-8 sm:px-7 sm:py-10 sm:first:pl-0 sm:last:pr-0">
              <h3 className="text-ink text-sm font-semibold">{value.title}</h3>
              <p className="text-ink-muted mt-2 text-sm leading-relaxed">{value.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}

/* ---------------------------------------------------------- How it works -- */

const STEPS = [
  {
    title: 'Tell us what you like',
    body: 'A handful of questions about what you shop for, the fits and colours you go for, and roughly what you spend. Skip anything you would rather not answer.',
  },
  {
    title: 'LivinUp learns your preferences',
    body: 'What you save, like and dismiss keeps refining the picture. Everything it works out is visible on your preferences page, and you can delete any of it.',
  },
  {
    title: 'Discover products that match',
    body: 'Your feed is ranked against your preferences, and every product tells you which of them it met — and which it did not.',
  },
  {
    title: 'Know when the price is worth it',
    body: 'Each listing is scored against its own recorded price history. When there is not enough history to be sure, LivinUp says so instead of guessing.',
  },
]

function HowItWorks() {
  return (
    <Section id="how-it-works" labelledBy="how-heading" size="lg">
      <SectionHeading
        id="how-heading"
        eyebrow="How it works"
        title="Four steps, and you are set up."
        description="No endless questionnaire, and nothing you cannot change later."
      />

      <ol className="mt-14 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-line border-t pt-5">
            <p className="text-ink-subtle font-mono text-xs font-medium">
              {String(index + 1).padStart(2, '0')}
            </p>
            <h3 className="text-ink mt-3 text-base font-semibold">{step.title}</h3>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{step.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* -------------------------------------------------------------- Discover -- */

const DISCOVER_POINTS = [
  'Ranked against the preferences you set, not an opaque trending list.',
  'Save, like or dismiss anything — each one sharpens what comes next.',
  'Compare every merchant LivinUp has ingested for a product, side by side.',
]

function Discover() {
  return (
    <Section id="discover" labelledBy="discover-heading" tone="sunken" bordered size="lg">
      <div className="grid items-center gap-12 lg:grid-cols-[1fr_minmax(0,26rem)] lg:gap-16">
        <div>
          <SectionHeading
            id="discover-heading"
            eyebrow="Discover"
            title="A feed that explains itself."
            description="Every product carries the reason it reached you, the merchants that stock it, and what its price has done over time. Nothing is ranked by a number you cannot see."
            align="start"
          />

          <ul className="mt-8 space-y-4">
            {DISCOVER_POINTS.map((point) => (
              <li key={point} className="text-ink-muted flex gap-3 text-sm leading-relaxed">
                <CheckMark />
                <span>{point}</span>
              </li>
            ))}
          </ul>

          <ButtonLink href="/signup" className="mt-9">
            Get started
          </ButtonLink>
        </div>

        <DiscoverPreview />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------- Personalization -- */

function Personalization() {
  return (
    <Section id="personalization" labelledBy="personalization-heading" size="lg">
      <SectionHeading
        id="personalization-heading"
        eyebrow="Personalization"
        title="Preferences you can actually see."
        description="LivinUp maps every product onto the same vocabulary — fit, style, colour, material, brand, price band — so a shirt from one merchant can be compared with a shirt from another."
      />

      <PreferencePreview className="mt-14" />

      <p className="text-ink-subtle mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed">
        A preference is only learned from your behaviour once the same signal repeats, so one
        curious click never becomes a stated taste.
      </p>
    </Section>
  )
}

/* ---------------------------------------------------- Price intelligence -- */

const PRICE_POINTS = [
  'Scored on recorded prices, never on a merchant’s “was” price.',
  'Five plain bands, from Poor to Excellent, with the reasoning shown.',
  'Too little history? LivinUp says so rather than inventing a verdict.',
]

function PriceIntelligence() {
  return (
    <Section id="price-intelligence" labelledBy="price-heading" tone="sunken" bordered size="lg">
      <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
        <div className="lg:sticky lg:top-24">
          <SectionHeading
            id="price-heading"
            eyebrow="Price intelligence"
            title="Is this actually a good price?"
            description="LivinUp records what a listing costs over time and scores the price today against its own history — the current price, the 30- and 90-day typical, and the lowest we have seen."
            align="start"
          />

          <ul className="mt-8 space-y-4">
            {PRICE_POINTS.map((point) => (
              <li key={point} className="text-ink-muted flex gap-3 text-sm leading-relaxed">
                <CheckMark />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <PricePreview />
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------- Final CTA -- */

function FinalCta() {
  return (
    <Section labelledBy="cta-heading" size="lg" width="content">
      <div className="text-center">
        <h2 id="cta-heading" className="text-ink text-3xl font-semibold text-balance sm:text-4xl">
          Shop with more confidence.
        </h2>
        <p className="text-ink-muted mx-auto mt-4 max-w-xl text-lg leading-relaxed text-pretty">
          Tell {APP_NAME} what you like. We&apos;ll help you find what is worth your attention.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/signup" size="lg" className="w-full sm:w-auto">
            Get started
          </ButtonLink>
          <ButtonLink href="/signin" variant="secondary" size="lg" className="w-full sm:w-auto">
            Sign in
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ Bits -- */

function CheckMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="text-accent mt-0.5 h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m4 10.5 4 4 8-9" />
    </svg>
  )
}
