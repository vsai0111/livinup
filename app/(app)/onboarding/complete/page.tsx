import { requireUser } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { countPreferences } from '@/lib/preferences/repository'
import { Button } from '@/components/ui/Button'
import { completeOnboardingAction } from '../actions'

export const metadata = { title: 'You are set up' }

export default async function OnboardingCompletePage() {
  const session = await requireUser('/onboarding/complete')
  const db = await getDb()
  const count = await countPreferences(db, session.id)

  return (
    <div className="mx-auto max-w-lg py-6 text-center sm:py-12">
      <span
        aria-hidden="true"
        className="border-accent/25 bg-accent-soft text-accent-strong inline-flex h-12 w-12 items-center justify-center rounded-full border"
      >
        <svg
          viewBox="0 0 20 20"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 10.5 4 4 8-9" />
        </svg>
      </span>

      <h1 className="text-ink mt-5 text-2xl font-semibold text-balance sm:text-3xl">
        That is enough to start
      </h1>

      <p className="text-ink-muted mt-3 text-base leading-relaxed text-pretty">
        {count === 0
          ? 'You skipped the questions, which is fine — your feed will start broad and sharpen as you save, like and dismiss things.'
          : `We have ${count} preference${count === 1 ? '' : 's'} to work with. Your feed will keep improving as you save, like and dismiss things.`}
      </p>

      <form action={completeOnboardingAction} className="mt-8">
        <Button type="submit" size="lg" className="w-full sm:w-auto">
          Show me my feed
        </Button>
      </form>

      <p className="text-ink-subtle mt-5 text-xs leading-relaxed">
        Everything you chose is editable from Preferences, along with anything LivinUp works out
        from your activity.
      </p>
    </div>
  )
}
