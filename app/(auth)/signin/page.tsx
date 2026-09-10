import { redirect } from 'next/navigation'
import { signInAction } from '../actions'
import { getCurrentUser } from '@/lib/auth'
import { AuthForm } from '@/components/layout/AuthForm'
import { safeInternalPath } from '@/lib/utils/url'
import { authCallbackMessage } from '@/lib/auth/callback-errors'

export const metadata = { title: 'Sign in' }

export default async function SignInPage({ searchParams }: PageProps<'/signin'>) {
  if (await getCurrentUser()) redirect('/home')

  const params = await searchParams
  const next = safeInternalPath(params.next, '/home')
  const notice = authCallbackMessage(params.error) ?? undefined

  return <AuthForm mode="signin" action={signInAction} next={next} notice={notice} />
}
