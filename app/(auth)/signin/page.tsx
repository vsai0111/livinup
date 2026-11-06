import { redirect } from 'next/navigation'
import { googleSignInAction, signInAction } from '../actions'
import { getCurrentUser } from '@/lib/auth'
import { AuthForm } from '@/components/layout/AuthForm'
import { safeInternalPath } from '@/lib/utils/url'
import { authCallbackMessage } from '@/lib/auth/callback-errors'
import { googleAuthEnabled } from '@/config/env.server'

export const metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  if (await getCurrentUser()) redirect('/home')

  const params = await searchParams
  const next = safeInternalPath(params.next, '/home')
  const notice = authCallbackMessage(params.error) ?? undefined

  return (
    <AuthForm
      mode="signin"
      action={signInAction}
      googleAction={googleAuthEnabled() ? googleSignInAction : undefined}
      next={next}
      notice={notice}
    />
  )
}
