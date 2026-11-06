'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { markNotificationsReadAction } from '@/app/actions/community'

/** Marks notifications read once the page has been seen, then refreshes the badge. */
export function MarkRead({ hasUnread }: { hasUnread: boolean }) {
  const router = useRouter()
  useEffect(() => {
    if (!hasUnread) return
    const timer = setTimeout(() => {
      void markNotificationsReadAction().then(() => router.refresh())
    }, 1200)
    return () => clearTimeout(timer)
  }, [hasUnread, router])
  return null
}
