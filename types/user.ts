export interface AuthUser {
  id: string
  email: string
}

export type AccountType = 'member' | 'brand'
export type Role = 'member' | 'admin'
export type AccountStatus = 'active' | 'suspended' | 'deleting'

export interface Profile {
  id: string
  displayName: string
  /** Null until onboarding sets it. Every public URL needs one. */
  username: string | null
  bio: string | null
  avatarMediaId: string | null
  accountType: AccountType
  role: Role
  status: AccountStatus
  exploreVisible: boolean
  onboardingCompleted: boolean
  createdAt: string
}

export interface SessionUser extends AuthUser {
  profile: Profile
}

export type EventType =
  | 'landing_view'
  | 'signup_started'
  | 'signup_completed'
  | 'signin_completed'
  | 'onboarding_started'
  | 'onboarding_completed'
  | 'item_added'
  | 'item_updated'
  | 'item_archived'
  | 'item_deleted'
  | 'outfit_saved'
  | 'outfit_deleted'
  | 'post_published'
  | 'post_deleted'
  | 'post_liked'
  | 'comment_added'
  | 'follow_added'
  | 'profile_viewed'
  | 'brand_profile_viewed'
  | 'share_clicked'
  | 'report_submitted'
  | 'notification_opened'
  | 'account_deleted'

export interface UserEventInput {
  userId?: string | null
  sessionId?: string | null
  eventType: EventType
  metadata?: Record<string, unknown>
}
