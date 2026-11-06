import { redirect } from 'next/navigation'
import { googleSignInAction, signUpAction } from '../actions'
import { getCurrentUser } from '@/lib/auth'
import { AuthForm } from '@/components/layout/AuthForm'
import { safeInternalPath } from '@/lib/utils/url'
import { googleAuthEnabled, serverEnv } from '@/config/env.server'

export const metadata = { title: 'Create your account' }

export default async function SignUpPage({ searchParams }: PageProps<'/signup'>) {
  if (await getCurrentUser()) redirect('/home')

  const params = await searchParams
  const next = safeInternalPath(params.next, '/onboarding')
  const invite = typeof params.invite === 'string' ? params.invite.slice(0, 40) : undefined

  return (
    <AuthForm
      mode="signup"
      action={signUpAction}
      googleAction={googleAuthEnabled() ? googleSignInAction : undefined}
      next={next}
      inviteRequired={serverEnv().LIVINUP_REQUIRE_INVITE}
      defaultInvite={invite}
    />
  )
}
