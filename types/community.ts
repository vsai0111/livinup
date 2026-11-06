import type { AccountType } from './user'

/** The few profile fields shown next to content. */
export interface AuthorSummary {
  id: string
  username: string
  displayName: string
  avatarMediaId: string | null
  accountType: AccountType
  verified: boolean
}

export interface PublicProfile extends AuthorSummary {
  bio: string | null
  websiteUrl: string | null
  followers: number
  following: number
  posts: number
  createdAt: string
}

/** How the viewer relates to a profile. */
export interface Relationship {
  isSelf: boolean
  following: boolean
  /** The viewer has blocked this account. */
  blocking: boolean
}

export interface PostImage {
  mediaId: string
  altText: string
  width: number
  height: number
}

export interface PostItem {
  label: string
  color: string | null
  brand: string | null
}

export interface PostView {
  id: string
  author: AuthorSummary
  caption: string
  occasions: string[]
  images: PostImage[]
  items: PostItem[]
  brands: AuthorSummary[]
  likeCount: number
  commentCount: number
  likedByViewer: boolean
  status: 'published' | 'removed'
  createdAt: string
  editedAt: string | null
}

export interface CommentView {
  id: string
  postId: string
  author: AuthorSummary
  body: string
  createdAt: string
  /** The viewer wrote it, or owns the post. */
  canDelete: boolean
}

export type NotificationType = 'follow' | 'like' | 'comment' | 'content_removed' | 'report_resolved'

export interface NotificationView {
  /** The newest underlying notification id. */
  id: string
  type: NotificationType
  actors: AuthorSummary[]
  /** Everyone involved, including those not listed in `actors`. */
  actorCount: number
  postId: string | null
  postImageId: string | null
  commentSnippet: string | null
  createdAt: string
  unread: boolean
}

export interface FeedPage {
  posts: PostView[]
  /** Pass back to load the next page; null at the end. */
  nextCursor: string | null
}
