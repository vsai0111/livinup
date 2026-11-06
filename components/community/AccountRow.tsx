import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import type { AuthorSummary } from '@/types/community'
import { VerifiedBadge } from './VerifiedBadge'

export function AccountRow({ account }: { account: AuthorSummary }) {
  return (
    <Link
      href={`/u/${account.username}`}
      className="hover:bg-surface-sunken flex items-center gap-3 rounded-lg px-2 py-2"
    >
      <Avatar name={account.displayName} mediaId={account.avatarMediaId} size="sm" />
      <span className="min-w-0">
        <span className="text-ink flex items-center gap-1 truncate text-sm font-medium">
          {account.displayName}
          {account.verified && <VerifiedBadge />}
        </span>
        <span className="text-ink-subtle block truncate text-xs">@{account.username}</span>
      </span>
    </Link>
  )
}
