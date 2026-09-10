import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  COLORS,
  FITS,
  PRICE_BANDS,
  STYLES,
  type Category,
} from '@/config/taxonomy'
import { requireUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { recordEvent } from '@/lib/analytics/events'
import { Button } from '@/components/ui/Button'
import { humanize } from '@/lib/utils/format'
import { saveOnboardingStepAction, skipOnboardingAction } from './actions'
import { ONBOARDING_STEPS, type OnboardingStep } from './steps'

export const metadata = { title: 'Set up your feed' }

interface StepDefinition {
  title: string
  subtitle: string
  options: Array<{ value: string; label: string }>
  multiple: boolean
}

const STEP_DEFINITIONS: Record<OnboardingStep, StepDefinition> = {
  categories: {
    title: 'What are you shopping for?',
    subtitle: 'Pick as many as you like. This is the biggest single thing that shapes your feed.',
    options: CATEGORIES.map((category) => ({
      value: category,
      label: CATEGORY_LABELS[category as Category],
    })),
    multiple: true,
  },
  colors: {
    title: 'Any colours you gravitate towards?',
    subtitle: 'Optional — it helps us rank, and you can change it any time.',
    options: COLORS.filter((color) => color !== 'multi').map((color) => ({
      value: color,
      label: humanize(color),
    })),
    multiple: true,
  },
  style: {
    title: 'How would you describe what you wear?',
    subtitle: 'Pick the words that fit. Skip if none of them do.',
    options: [...STYLES, ...FITS].map((value) => ({ value, label: humanize(value) })),
    multiple: true,
  },
  budget: {
    title: 'Roughly what do you usually spend?',
    subtitle: 'A range is enough. We use it to rank, never to hide things from you.',
    options: PRICE_BANDS.map((band) => ({ value: band.id, label: `$${band.label}` })),
    multiple: true,
  },
}

/** Short labels for the step rail, so progress reads as content rather than a number. */
const STEP_LABELS: Record<OnboardingStep, string> = {
  categories: 'Categories',
  colors: 'Colours',
  style: 'Style',
  budget: 'Budget',
}

function isStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && (ONBOARDING_STEPS as readonly string[]).includes(value)
}

/**
 * Onboarding.
 *
 * One question per screen, each a plain form POST — so the flow survives a
 * refresh, a back button and a browser with JavaScript switched off, which a
 * multi-step client wizard holding its answers in memory does not.
 */
export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const session = await requireUser('/onboarding')
  const params = await searchParams

  const step: OnboardingStep = isStep(params.step) ? params.step : 'categories'
  const index = ONBOARDING_STEPS.indexOf(step)
  const definition = STEP_DEFINITIONS[step]
  const following = ONBOARDING_STEPS[index + 1]
  const nextHref = following ? `/onboarding?step=${following}` : '/onboarding/complete'
  const isLast = index === ONBOARDING_STEPS.length - 1

  // Someone who has already finished has no reason to be here.
  if (session.profile.onboardingCompleted && !params.step) redirect('/home')

  if (index === 0) {
    const db = await getDb()
    await recordEvent(db, { userId: session.id, eventType: 'onboarding_started' })
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* --- Progress --- */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-ink-subtle text-xs font-medium tracking-wide uppercase">
          Step {index + 1} of {ONBOARDING_STEPS.length}
        </p>
        <p className="text-ink-subtle text-xs">{STEP_LABELS[step]}</p>
      </div>

      {/*
        Native progress element: exposes value and max to assistive tech for
        free, and degrades to a sensible control if the custom styling is not
        applied. The segments below are decorative reinforcement, not the
        accessible source of truth.
      */}
      <progress className="sr-only" value={index + 1} max={ONBOARDING_STEPS.length}>
        {index + 1} of {ONBOARDING_STEPS.length}
      </progress>

      <ol aria-hidden="true" className="mt-2 flex gap-1.5">
        {ONBOARDING_STEPS.map((name, position) => (
          <li
            key={name}
            className={`h-1 flex-1 rounded-full ${position <= index ? 'bg-ink' : 'bg-line'}`}
          />
        ))}
      </ol>

      {/* --- Question --- */}
      <h1 className="text-ink mt-8 text-2xl font-semibold text-balance sm:text-3xl">
        {definition.title}
      </h1>
      <p className="text-ink-muted mt-2.5 text-base leading-relaxed">{definition.subtitle}</p>

      <form action={saveOnboardingStepAction} className="mt-8">
        <input type="hidden" name="step" value={step} />

        <fieldset>
          <legend className="sr-only">{definition.title}</legend>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {definition.options.map((option) => (
              <label
                key={option.value}
                className={
                  'group border-line-strong bg-surface text-ink relative flex cursor-pointer ' +
                  'items-center justify-between gap-2 rounded-[var(--radius-control)] border ' +
                  'px-3.5 py-3 text-sm font-medium transition-colors ' +
                  'hover:border-ink-subtle hover:bg-surface-sunken ' +
                  // Green for selection, matching the Preferences page and the
                  // match chips on a product: across the product, green means
                  // "this is about you", ink means "this is a control".
                  'has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent-strong ' +
                  'has-focus-visible:outline-primary has-focus-visible:outline has-focus-visible:outline-2 ' +
                  'has-focus-visible:outline-offset-2'
                }
              >
                <input type="checkbox" name="value" value={option.value} className="sr-only" />
                <span>{option.label}</span>
                {/*
                  Selection is carried by the border and the tick together. The
                  tick matters: a border-weight change alone is invisible to
                  plenty of people, and the checkbox itself is off-screen.
                */}
                <CheckIndicator />
              </label>
            ))}
          </div>
        </fieldset>

        <div className="border-line mt-8 flex flex-wrap items-center gap-3 border-t pt-6">
          <Button type="submit" size="lg">
            {isLast ? 'Finish setup' : 'Continue'}
          </Button>

          {/* A link, not a submit button: a submit would save whatever boxes
              happened to be ticked, which is the opposite of skipping. */}
          <Link
            href={nextHref}
            className="text-ink-muted hover:text-ink inline-flex h-12 items-center px-2 text-sm font-medium"
          >
            Skip this question
          </Link>
        </div>
      </form>

      <form action={skipOnboardingAction} className="mt-8">
        <button
          type="submit"
          className="text-ink-subtle hover:text-ink text-xs underline underline-offset-2"
        >
          Skip setup entirely and go straight to my feed
        </button>
      </form>
    </div>
  )
}

function CheckIndicator() {
  return (
    <span
      aria-hidden="true"
      className="border-line-strong text-accent-ink group-has-checked:border-accent group-has-checked:bg-accent flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full border transition-colors"
    >
      <svg
        viewBox="0 0 12 12"
        className="h-2.5 w-2.5 opacity-0 group-has-checked:opacity-100"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m2 6.2 2.6 2.6L10 3.4" />
      </svg>
    </span>
  )
}
