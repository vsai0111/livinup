import { redirect } from 'next/navigation'
import { serverEnv } from '@/config/env.server'
import { requireUser } from '@/lib/auth'
import { listVerifiedBrands } from '@/lib/brands/repository'
import { getDb } from '@/lib/db'
import { consentState, suggestedAccounts } from '@/lib/profiles/repository'
import { suggestUsername } from '@/lib/profiles/username'
import { countItems } from '@/lib/wardrobe/repository'
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow'

export const metadata = { title: 'Set up LivinUp' }

export default async function OnboardingPage({ searchParams }: PageProps<'/onboarding'>) {
  const session = await requireUser('/onboarding')
  const params = await searchParams
  const requested = params.step === 'pieces' || params.step === 'follow' ? params.step : 'identity'

  // Without a username only the first step is possible; with one, the first is done.
  const step = !session.profile.username
    ? 'identity'
    : requested === 'identity'
      ? 'pieces'
      : requested
  if (session.profile.onboardingCompleted && session.profile.username && !params.step)
    redirect('/home')

  const db = await getDb()
  const [state, itemCount, suggestions, brands] = await Promise.all([
    consentState(db, session.id),
    session.profile.username ? countItems(db, session.id) : Promise.resolve(0),
    step === 'follow' ? suggestedAccounts(db, session.id, 8) : Promise.resolve([]),
    step === 'pieces' ? listVerifiedBrands(db) : Promise.resolve([]),
  ])

  return (
    <OnboardingFlow
      step={step}
      displayName={session.profile.displayName}
      suggestedUsername={session.profile.username ?? suggestUsername(session.profile.displayName)}
      needsConsent={!state.consented}
      needsInvite={
        serverEnv().LIVINUP_REQUIRE_INVITE && !state.inviteCode && session.profile.role !== 'admin'
      }
      itemCount={itemCount}
      suggestions={suggestions}
      brands={brands.map((brand) => ({ id: brand.id, displayName: brand.displayName }))}
    />
  )
}
