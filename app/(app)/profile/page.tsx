import { redirect } from 'next/navigation'
import { requireOnboardedUser } from '@/lib/auth'

/** /profile is a shortcut to your public profile. */
export default async function MyProfile() {
  const session = await requireOnboardedUser('/profile')
  redirect(`/u/${session.profile.username}`)
}
