import { resetPasswordAction } from '../../actions'
import { NewPasswordForm } from '@/components/layout/ResetPasswordForms'

export const metadata = { title: 'Choose a new password' }

export default async function NewPasswordPage({ searchParams }: PageProps<'/reset-password/new'>) {
  const params = await searchParams
  // The local provider's signed token; Supabase uses the recovery session instead.
  const token = typeof params.token === 'string' ? params.token.slice(0, 512) : undefined
  return <NewPasswordForm action={resetPasswordAction} token={token} />
}
