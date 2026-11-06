'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { setFollowAction } from '@/app/actions/community'
import { Button } from '@/components/ui/Button'

export function FollowButton({
  profileId,
  initialFollowing,
  size = 'sm',
}: {
  profileId: string
  initialFollowing: boolean
  size?: 'sm' | 'md'
}) {
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const toggle = () => {
    const next = !following
    setFollowing(next)
    setError(null)
    startTransition(async () => {
      const result = await setFollowAction(profileId, next)
      if (!result.ok) {
        setFollowing(!next)
        setError(result.error)
      } else {
        router.refresh()
      }
    })
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        size={size}
        variant={following ? 'secondary' : 'primary'}
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
      >
        {following ? 'Following' : 'Follow'}
      </Button>
      {error && (
        <span role="alert" className="text-negative text-xs">
          {error}
        </span>
      )}
    </span>
  )
}
