import Link from 'next/link'
import type { ReactNode } from 'react'
import { APP_NAME, APP_TAGLINE } from '@/config/app'
import { getCurrentUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { recordEvent } from '@/lib/analytics/events'
import { ensureSessionId } from '@/lib/analytics/session'
import { PublicShell } from '@/components/layout/PublicShell'
import { ButtonLink } from '@/components/ui/Button'
import { GarmentIcon } from '@/components/wardrobe/GarmentIcon'
import { Asterisk } from '@/components/marketing/Asterisk'
import { HeroArc } from '@/components/marketing/HeroArc'
import { Marquee } from '@/components/marketing/Marquee'
import { ScrollEffects } from '@/components/marketing/ScrollEffects'
import '@/components/marketing/landing.css'

export const metadata = {
  title: { absolute: `${APP_NAME} · ${APP_TAGLINE}` },
  description:
    'A private digital wardrobe for the clothes you own, an outfit board that understands sarees, lehengas and sherwanis, and a community to share your looks.',
}

/**
 * Landing page.
 *
 * Shown to everyone; signed-in members get "Open app" instead of sign-up
 * buttons. Everything described here exists in v1: wardrobe, outfits, posts,
 * follows, verified brand profiles and account deletion. The hero is the one
 * from the original landing page; the sections below are the v1 ones.
 */
export default async function LandingPage() {
  const user = await getCurrentUser()

  // First funnel step, recorded server-side so it does not depend on a
  // third-party script loading.
  const sessionId = await ensureSessionId()
  await recordEvent(await getDb(), {
    eventType: 'landing_view',
    sessionId,
    userId: user?.id ?? null,
  })

  return (
    <PublicShell signedIn={Boolean(user)}>
      <Hero signedIn={Boolean(user)} />
      <Wearables />
      <Features />
      <OutfitSection />
      <CommunitySection />
      <BrandsSection />
      <PrivacySection />
      <Faq />
      <FinalCta />
    </PublicShell>
  )
}

/* ------------------------------------------------------------------ layout */

function Section({
  id,
  children,
  className = '',
}: {
  id?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} className={`py-20 sm:py-24 ${className}`}>
      <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-accent text-sm font-semibold">{children}</p>
}

function SectionHeading({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow: string
  title: string
  body: string
  center?: boolean
}) {
  return (
    <div className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="text-ink mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h2>
      <p className="text-ink-muted mt-4 text-base leading-relaxed">{body}</p>
    </div>
  )
}

/** Browser-window frame around a product preview. */
function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <figure
      className="border-line bg-surface overflow-hidden rounded-xl border shadow-[0_1px_2px_rgb(13_17_23/0.04),0_24px_48px_-24px_rgb(13_17_23/0.18)]"
      aria-label={label}
    >
      <div className="border-line bg-surface-sunken flex h-9 items-center gap-1.5 border-b px-3.5">
        <span className="bg-line-strong size-2.5 rounded-full" />
        <span className="bg-line-strong size-2.5 rounded-full" />
        <span className="bg-line-strong size-2.5 rounded-full" />
        <span className="text-ink-subtle ml-3 font-mono text-[11px]">livinup.in</span>
      </div>
      {children}
    </figure>
  )
}

function Tile({
  type,
  color,
  label,
  className = '',
}: {
  type: string
  color: string
  label?: string
  className?: string
}) {
  return (
    <div className={`bg-surface-sunken rounded-lg p-2 ${className}`}>
      <GarmentIcon itemType={type} color={color} className="mx-auto aspect-square w-full" />
      {label && <p className="text-ink-muted mt-1 truncate text-center text-[11px]">{label}</p>}
    </div>
  )
}

/* -------------------------------------------------------------------- hero */

/**
 * The hero from the original landing page: the headline rises in line by
 * line, the fanned wardrobe cards pivot as the page scrolls, and the lime
 * ticker runs underneath. Styles live in components/marketing/landing.css,
 * scoped under `.lp`.
 */
function Hero({ signedIn }: { signedIn: boolean }) {
  return (
    <div className="lp">
      <ScrollEffects />
      <section className="relative overflow-hidden pt-16 pb-0 sm:pt-24" aria-labelledby="hero">
        <div className="lp-rules" aria-hidden="true" />

        <div className="lp-shell relative">
          <h1 id="hero" className="lp-display text-center">
            <span className="lp-rise" style={{ ['--d' as string]: 0 }}>
              <span>Your wardrobe.</span>
            </span>
            <span className="lp-rise" style={{ ['--d' as string]: 1 }}>
              {/* Real spaces around the glyph, so a screen reader hears "Your style". */}
              <span>
                Your <Asterisk className="lp-hero-mark" color="var(--lp-clay)" weight={3.1} />{' '}
                style.
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
            Build outfits from the clothes you already own, share the looks you love, and follow the
            people and brands whose style you like.
          </p>

          <div
            className="lp-fade mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            style={{ ['--d' as string]: 5 }}
          >
            <Link
              href={signedIn ? '/wardrobe' : '/signup'}
              className="lp-btn lp-btn-ink lp-magnet w-full sm:w-auto"
            >
              {signedIn ? 'Open my wardrobe' : 'Build my wardrobe'}
            </Link>
            <a href="#features" className="lp-btn lp-btn-outline w-full sm:w-auto">
              See how it works
            </a>
          </div>

          <p
            className="lp-fade mt-5 text-center"
            style={{ ['--d' as string]: 6, color: 'var(--lp-ink-faint)' }}
          >
            <span className="lp-label">Free · private until you share · 18+</span>
          </p>
        </div>

        <HeroArc />
      </section>

      <Marquee items={TICKER} />
    </div>
  )
}

const TICKER = [
  'Photograph what you own',
  'Outfits from your own clothes',
  'Sarees, lehengas, sherwanis and more',
  'Share the looks you love',
  'Follow verified brands',
]

/* --------------------------------------------------------------- wearables */

function Wearables() {
  const kinds = [
    'Sarees',
    'Lehengas',
    'Salwar suits',
    'Kurtas',
    'Sherwanis',
    'Nehru jackets',
    'Dupattas',
    'Juttis',
    'Kolhapuris',
    'Denim',
    'Sneakers',
    'Blazers',
  ]
  return (
    <div className="border-line border-y">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:items-center lg:px-8">
        <p className="text-ink-subtle shrink-0 text-sm">Built for how India dresses</p>
        <ul className="flex flex-wrap gap-2">
          {kinds.map((kind) => (
            <li
              key={kind}
              className="border-line text-ink-muted rounded-full border px-3 py-1 text-xs font-medium"
            >
              {kind}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- features */

function Features() {
  const features = [
    {
      title: 'A wardrobe you can search',
      body: 'Add up to ten photos at a time. Tag colour, fabric, brand and occasion, and find any piece in a tap.',
      icon: <IconHanger />,
    },
    {
      title: 'Outfits that make sense',
      body: 'Build looks from what you own. A dress fills top and bottom; a saree leaves room for its blouse.',
      icon: <IconLayers />,
    },
    {
      title: 'Share when you want to',
      body: 'Post a look, tag the pieces and brands, and follow people whose style you like.',
      icon: <IconSpark />,
    },
    {
      title: 'Verified brands',
      body: 'Follow labels you love. Brand profiles are verified by us, so a badge means something.',
      icon: <IconBadge />,
    },
    {
      title: 'Private by default',
      body: 'Your wardrobe photos are never public. Only the looks you choose to post can be seen by others.',
      icon: <IconLock />,
    },
    {
      title: 'Leave any time',
      body: 'Delete your account from settings and your photos, posts and data go with it.',
      icon: <IconDoor />,
    },
  ]
  return (
    <Section id="features">
      <SectionHeading
        center
        eyebrow="Features"
        title="Your cupboard, finally organised"
        body="Everything you need to see what you own, wear more of it and share the results. Nothing you do not."
      />
      <div className="bg-line border-line mt-14 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <div key={feature.title} className="bg-surface p-7">
            <div className="border-line text-ink flex size-10 items-center justify-center rounded-lg border">
              {feature.icon}
            </div>
            <h3 className="text-ink mt-5 text-base font-semibold">{feature.title}</h3>
            <p className="text-ink-muted mt-2 text-sm leading-relaxed">{feature.body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------ outfit */

function OutfitSection() {
  const zones: [string, string, string, string][] = [
    ['Top', 'blouse', 'gold', 'Silk blouse'],
    ['Bottom', 'saree', 'maroon', 'Banarasi saree'],
    ['Drape', 'stole', 'cream', 'Pashmina shawl'],
    ['Footwear', 'heels', 'gold', 'Block heels'],
    ['Accessory', 'jewellery', 'gold', 'Temple necklace'],
    ['Accessory', 'bag', 'maroon', 'Potli bag'],
  ]
  return (
    <Section className="bg-surface-sunken">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionHeading
            eyebrow="Outfit board"
            title="Not every outfit is a top and a bottom"
            body="LivinUp plans outfits by zone: top, bottom, layer, drape, footwear and accessories. Sarees, lehenga sets, anarkalis and sherwanis each fill the zones they really cover, so the board never asks for a piece you do not need."
          />
          <ul className="mt-8 space-y-3">
            {[
              'Pick pieces from your own wardrobe, not a catalogue',
              'Save outfits by occasion: work, festive, wedding, travel',
              'Turn any outfit into a post in one step',
            ].map((point) => (
              <li key={point} className="text-ink flex gap-3 text-sm">
                <IconCheck />
                {point}
              </li>
            ))}
          </ul>
        </div>

        <Frame label="Illustration of the outfit board">
          <div className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-ink text-sm font-semibold">Sangeet night</p>
                <p className="text-ink-subtle text-xs">Wedding · 6 pieces</p>
              </div>
              <span className="border-line text-ink-muted rounded-md border px-2 py-1 text-[11px] font-medium">
                Share as post
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3">
              {zones.map(([zone, type, color, label], i) => (
                <div key={i} className="border-line rounded-lg border p-2">
                  <p className="text-ink-subtle text-[10px] font-medium tracking-wide uppercase">
                    {zone}
                  </p>
                  <Tile type={type} color={color} className="mt-1.5" />
                  <p className="text-ink-muted mt-1.5 truncate text-[11px]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Frame>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------- community */

function CommunitySection() {
  return (
    <Section>
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div className="order-2 mx-auto w-full max-w-sm lg:order-1">
          <div
            className="border-line bg-surface overflow-hidden rounded-xl border shadow-[var(--shadow-raised)]"
            aria-label="Illustration of a post"
            role="img"
          >
            <div className="flex items-center gap-2.5 p-3">
              <span className="bg-accent-soft text-accent flex size-8 items-center justify-center rounded-full text-xs font-semibold">
                AR
              </span>
              <div className="leading-tight">
                <p className="text-ink text-sm font-semibold">aanya.r</p>
                <p className="text-ink-subtle text-[11px]">Bengaluru</p>
              </div>
            </div>
            <div className="bg-surface-sunken grid grid-cols-2 gap-2 p-4">
              <Tile type="shirt" color="white" />
              <Tile type="trousers" color="beige" />
              <Tile type="blazer" color="navy" />
              <Tile type="loafers" color="brown" />
            </div>
            <div className="p-3">
              <div className="text-ink flex gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <IconHeart /> 128
                </span>
                <span className="text-ink-muted">14 comments</span>
              </div>
              <p className="text-ink mt-2 text-sm">
                <span className="font-semibold">aanya.r</span> First week at the new job. Linen
                everything.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {['Linen shirt', 'Pleated trousers', 'Navy blazer'].map((tag) => (
                  <span
                    key={tag}
                    className="bg-surface-sunken text-ink-muted rounded px-1.5 py-0.5 text-[11px]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <SectionHeading
            eyebrow="Community"
            title="Style, shared on your terms"
            body="Post a look and tag the pieces from your wardrobe. Follow friends and creators, like and comment, and keep your feed to people you chose."
          />
          <dl className="mt-8 grid gap-6 sm:grid-cols-2">
            <Fact title="You decide what is public">
              Your wardrobe stays private. Only the looks you post are visible to others.
            </Fact>
            <Fact title="Real controls">
              Block anyone, report anything, and reports are reviewed by people.
            </Fact>
          </dl>
        </div>
      </div>
    </Section>
  )
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-ink text-sm font-semibold">{title}</dt>
      <dd className="text-ink-muted mt-1 text-sm leading-relaxed">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ brands */

function BrandsSection() {
  return (
    <Section className="bg-surface-sunken">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:items-center">
        <SectionHeading
          eyebrow="For brands"
          title="A home for Indian labels"
          body="Verified brand profiles share collections and lookbooks, and members can tag the brands they wear. No ads in the feed and no product listings, just the clothes and the people who wear them."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border-line bg-surface rounded-xl border p-5">
            <IconBadge />
            <p className="text-ink mt-4 text-sm font-semibold">Verified by LivinUp</p>
            <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
              Every brand account is checked and set up by our team before it gets a badge.
            </p>
          </div>
          <div className="border-line bg-surface rounded-xl border p-5">
            <IconSpark />
            <p className="text-ink mt-4 text-sm font-semibold">Seen in real outfits</p>
            <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">
              Member posts that tag a brand appear on its profile, so you see how pieces are worn.
            </p>
          </div>
          <div className="sm:col-span-2">
            <ButtonLink href="/brands" variant="secondary">
              Browse brands
            </ButtonLink>
          </div>
        </div>
      </div>
    </Section>
  )
}

/* ----------------------------------------------------------------- privacy */

function PrivacySection() {
  const points = [
    ['Private wardrobe', 'Wardrobe photos are served only to you, through access-checked links.'],
    ['No ads', 'There are no ads on LivinUp, and we do not sell your data.'],
    ['Delete everything', 'Account deletion removes your photos, posts, comments and profile.'],
    ['Grievances', 'A published process for complaints and takedown requests.'],
  ]
  return (
    <Section>
      <SectionHeading
        center
        eyebrow="Privacy"
        title="Your cupboard is nobody else's business"
        body="LivinUp is built so that the default is private and every share is a choice you make."
      />
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {points.map(([title, body]) => (
          <div key={title} className="border-line rounded-xl border p-5">
            <IconLock />
            <p className="text-ink mt-4 text-sm font-semibold">{title}</p>
            <p className="text-ink-muted mt-1.5 text-sm leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------------- faq */

function Faq() {
  const faqs = [
    [
      'Is LivinUp free?',
      'Yes. The wardrobe, outfits and community are free to use during the beta.',
    ],
    [
      'Who can see my wardrobe?',
      'Only you. Wardrobe items stay private. Other people only see what you choose to post.',
    ],
    [
      'Can I add clothes without a photo?',
      'Yes. Pick the type and colour and LivinUp draws a placeholder, so you can catalogue quickly and add photos later.',
    ],
    [
      'Can I buy clothes on LivinUp?',
      'No. LivinUp is about the clothes you already own. There are no listings, ads or checkout.',
    ],
    [
      'Who can join?',
      'Anyone in India aged 18 or over. During the beta, sign-ups may need an invite code.',
    ],
  ]
  return (
    <Section className="bg-surface-sunken">
      <div className="grid gap-10 lg:grid-cols-[1fr_1.6fr]">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions, answered"
          body="Anything else? Write to us from the grievance page and a person will reply."
        />
        <div className="border-line bg-surface divide-line divide-y rounded-xl border">
          {faqs.map(([question, answer]) => (
            <details key={question} className="group px-5 py-4">
              <summary className="text-ink flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold">
                {question}
                <span
                  aria-hidden="true"
                  className="text-ink-subtle transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </summary>
              <p className="text-ink-muted mt-2.5 text-sm leading-relaxed">{answer}</p>
            </details>
          ))}
        </div>
      </div>
    </Section>
  )
}

/* --------------------------------------------------------------------- cta */

function FinalCta() {
  return (
    <Section>
      <div className="bg-primary relative overflow-hidden rounded-2xl px-6 py-14 text-center sm:px-12">
        <h2 className="text-primary-ink text-3xl font-semibold tracking-tight sm:text-4xl">
          Open your wardrobe
        </h2>
        <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-white/70">
          Add your first ten pieces in a few minutes and see what you can make with them.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/signup" size="lg" variant="secondary" className="border-transparent">
            Create your account
          </ButtonLink>
        </div>
      </div>
    </Section>
  )
}

/* ------------------------------------------------------------------- icons */

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-5"
    >
      {children}
    </svg>
  )
}

const IconHanger = () => (
  <Svg>
    <path d="M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3m0 0-9 7.5c-.6.5-.2 1.5.6 1.5h16.8c.8 0 1.2-1 .6-1.5L12 8" />
  </Svg>
)
const IconLayers = () => (
  <Svg>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
)
const IconSpark = () => (
  <Svg>
    <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />
  </Svg>
)
const IconBadge = () => (
  <Svg>
    <path d="m12 2 2.4 2.1 3.2-.3.7 3.1 2.8 1.6-1.3 2.9 1.3 2.9-2.8 1.6-.7 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.7-3.1-2.8-1.6 1.3-2.9-1.3-2.9 2.8-1.6.7-3.1 3.2.3L12 2Z" />
    <path d="m9 12 2 2 4-4" />
  </Svg>
)
const IconLock = () => (
  <Svg>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
)
const IconDoor = () => (
  <Svg>
    <path d="M14 3h5v18h-5M10 17l5-5-5-5M15 12H3" />
  </Svg>
)
const IconHeart = () => (
  <Svg>
    <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
  </Svg>
)
function IconCheck() {
  return (
    <span className="bg-accent-soft text-accent mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-3">
        <path
          d="m3.5 8.5 3 3 6-7"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
