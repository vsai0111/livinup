import { bool, isoDate, str, strOrNull } from '@/lib/db/rows'
import type { AccountStatus, AccountType, Profile, Role } from '@/types/user'

/** Columns that make up a Profile. Shared so every read returns the same shape. */
export const PROFILE_COLUMNS =
  'id, display_name, username, bio, avatar_media_id, account_type, role, status, ' +
  'explore_visible, onboarding_completed, created_at'

export interface ProfileRow {
  id: unknown
  display_name: unknown
  username: unknown
  bio: unknown
  avatar_media_id: unknown
  account_type: unknown
  role: unknown
  status: unknown
  explore_visible: unknown
  onboarding_completed: unknown
  created_at: unknown
}

export function profileFromRow(row: ProfileRow): Profile {
  return {
    id: str(row.id),
    displayName: str(row.display_name),
    username: strOrNull(row.username),
    bio: strOrNull(row.bio),
    avatarMediaId: strOrNull(row.avatar_media_id),
    accountType: (str(row.account_type, 'member') as AccountType) ?? 'member',
    role: (str(row.role, 'member') as Role) ?? 'member',
    status: (str(row.status, 'active') as AccountStatus) ?? 'active',
    exploreVisible: row.explore_visible === undefined ? true : bool(row.explore_visible),
    onboardingCompleted: bool(row.onboarding_completed),
    createdAt: isoDate(row.created_at),
  }
}
