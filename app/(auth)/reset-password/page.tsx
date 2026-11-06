import { requestPasswordResetAction } from '../actions'
import { RequestResetForm } from '@/components/layout/ResetPasswordForms'

export const metadata = { title: 'Reset your password' }

export default function ResetPasswordPage() {
  return <RequestResetForm action={requestPasswordResetAction} />
}
