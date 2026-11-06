import type { Metadata } from 'next'
import Link from 'next/link'
import { PAGE_SIZE } from '@/config/app'
import { getSessionUser } from '@/lib/auth'
import { recordEvent } from '@/lib/analytics/events'
import { listConnections } from '@/lib/community/follows'
import { authorPosts, brandTaggedPosts } from '@/lib/community/posts'
import { getDb } from '@/lib/db'
import { mediaUrl } from '@/lib/media/url'
import { getPublicProfile } from '@/lib/profiles/repository'
import { displayHost, isSafeHttpUrl } from '@/lib/utils/url'
import { formatCount, formatDate } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import { PageContainer } from '@/components/layout/PageContainer'
import { AccountRow } from '@/components/community/AccountRow'
import { FollowButton } from '@/components/community/FollowButton'
import { ProfileMenu } from '@/components/community/ProfileMenu'
import { ShareButton } from '@/components/community/ShareButton'
import { VerifiedBadge } from '@/components/community/VerifiedBadge'
import { MediaImage } from '@/components/media/MediaImage'
import { Avatar } from '@/components/ui/Avatar'
import { ButtonLink } from '@/components/ui/Button'
import type { PostView } from '@/types/community'

/**
 * A profile. Public, read-only for visitors. It never shows the wardrobe or
 * outfits (spec 3.3): only published posts.
 */

async function load(username: string) {
  const [db, session] = await Promise.all([getDb(), getSessionUser()])
  const result = await getPublicProfile(db, username, session?.id ?? null)
  return { db, session, result }
}

export async function generateMetadata({ params }: PageProps<'/u/[username]'>): Promise<Metadata> {
  const { username } = await params
  const { result } = await load(username)
  if (!result) return { title: 'Account not available', robots: { index: false } }
  const { profile } = result
  return {
    title: `${profile.displayName} (@${profile.username})`,
    description: profile.bio ?? `${profile.displayName}'s outfits on LivinUp.`,
    openGraph: {
      title: `${profile.displayName} on LivinUp`,
      description: profile.bio ?? undefined,
      images: profile.avatarMediaId ? [mediaUrl(profile.avatarMediaId, 'md')] : undefined,
    },
  }
}

function PostGrid({ posts }: { posts: PostView[] }) {
  return (
    <ul className="grid grid-cols-3 gap-1 sm:gap-2">
      {posts.map((post) => (
        <li key={post.id}>
          <Link
            href={`/p/${post.id}`}
            className="bg-surface-sunken relative block aspect-[4/5] overflow-hidden rounded-md sm:rounded-lg"
          >
            {post.images[0] && (
              <MediaImage
                id={post.images[0].mediaId}
                size="sm"
                alt={post.images[0].altText || `Post by @${post.author.username}`}
              />
            )}
          </Link>
        </li>
      ))}
    </ul>
  )
}

export default async function ProfilePage({ params, searchParams }: PageProps<'/u/[username]'>) {
  const { username } = await params
  const query = await searchParams
  const view = query.view === 'followers' || query.view === 'following' ? query.view : 'posts'
  const cursor = typeof query.cursor === 'string' ? query.cursor : null

  const { db, session, result } = await load(username)
  if (!result) {
    return (
      <PageContainer width="narrow">
        <div className="py-16 text-center">
          <h1 className="text-ink text-xl font-semibold">This account isn’t available</h1>
          <p className="text-ink-muted mt-2 text-sm">
            It may have been removed, or the link may be wrong.
          </p>
          <ButtonLink href={session ? '/home' : '/'} variant="secondary" className="mt-6">
            {session ? 'Back to home' : 'Go to LivinUp'}
          </ButtonLink>
        </div>
      </PageContainer>
    )
  }

  const { profile, relationship } = result
  const viewerId = session?.id ?? null

  if (!relationship.isSelf) {
    await recordEvent(db, {
      userId: viewerId,
      eventType: profile.accountType === 'brand' ? 'brand_profile_viewed' : 'profile_viewed',
      metadata: { source: typeof query.from === 'string' ? query.from.slice(0, 20) : 'direct' },
    })
  }

  const [posts, tagged, connections] = await Promise.all([
    view === 'posts'
      ? authorPosts(db, profile.id, viewerId, { cursor, limit: PAGE_SIZE.profilePosts })
      : null,
    view === 'posts' && profile.accountType === 'brand' && profile.verified
      ? brandTaggedPosts(db, profile.id, viewerId, 12)
      : Promise.resolve([] as PostView[]),
    view !== 'posts' ? listConnections(db, profile.id, view, viewerId) : Promise.resolve([]),
  ])

  const tabs = [
    { id: 'posts', label: `${formatCount(profile.posts)} posts`, href: `/u/${profile.username}` },
    {
      id: 'followers',
      label: `${formatCount(profile.followers)} followers`,
      href: `/u/${profile.username}?view=followers`,
    },
    {
      id: 'following',
      label: `${formatCount(profile.following)} following`,
      href: `/u/${profile.username}?view=following`,
    },
  ]

  return (
    <PageContainer>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <Avatar name={profile.displayName} mediaId={profile.avatarMediaId} size="xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-ink flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
              {profile.displayName}
              {profile.verified && <VerifiedBadge className="h-5 w-5" />}
            </h1>
            <div className="flex items-center gap-1">
              {relationship.isSelf ? (
                <ButtonLink href="/settings" variant="secondary" size="sm">
                  Edit profile
                </ButtonLink>
              ) : session ? (
                !relationship.blocking && (
                  <FollowButton profileId={profile.id} initialFollowing={relationship.following} />
                )
              ) : (
                <ButtonLink
                  href={`/signin?next=${encodeURIComponent(`/u/${profile.username}`)}`}
                  size="sm"
                >
                  Follow
                </ButtonLink>
              )}
              <ShareButton
                path={`/u/${profile.username}`}
                title={`${profile.displayName} on LivinUp`}
                kind="profile"
                label=""
                className="w-9 justify-center px-0"
              />
              {session && !relationship.isSelf && (
                <ProfileMenu
                  profileId={profile.id}
                  username={profile.username}
                  blocking={relationship.blocking}
                />
              )}
            </div>
          </div>
          <p className="text-ink-subtle mt-0.5 text-sm">
            @{profile.username}
            {profile.accountType === 'brand' && profile.verified ? ' · Verified brand' : ''}
          </p>
          {profile.bio && (
            <p className="text-ink mt-3 max-w-xl text-sm leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          )}
          <div className="text-ink-muted mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {profile.websiteUrl && isSafeHttpUrl(profile.websiteUrl) && (
              <a
                href={profile.websiteUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-ink font-medium hover:underline"
              >
                {displayHost(profile.websiteUrl)} ↗
              </a>
            )}
            <span>Joined {formatDate(profile.createdAt)}</span>
          </div>
        </div>
      </header>

      {relationship.blocking ? (
        <div className="border-line mt-8 rounded-2xl border border-dashed p-8 text-center">
          <p className="text-ink-muted text-sm">
            You have blocked this account. Unblock it from the menu to see its posts.
          </p>
        </div>
      ) : (
        <>
          <nav aria-label="Profile sections" className="border-line mt-8 flex gap-1 border-b">
            {tabs.map((tab) => (
              <Link
                key={tab.id}
                href={tab.href}
                aria-current={view === tab.id ? 'page' : undefined}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2.5 text-sm',
                  view === tab.id
                    ? 'border-ink text-ink font-semibold'
                    : 'text-ink-muted hover:text-ink border-transparent font-medium',
                )}
              >
                {tab.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5">
            {view === 'posts' &&
              posts &&
              (posts.posts.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-ink-muted text-sm">
                    {relationship.isSelf ? 'You have not posted yet.' : 'No posts yet.'}
                  </p>
                  {relationship.isSelf && (
                    <ButtonLink href="/create" className="mt-4" size="sm">
                      Share your first outfit
                    </ButtonLink>
                  )}
                </div>
              ) : (
                <>
                  <PostGrid posts={posts.posts} />
                  {posts.nextCursor && (
                    <div className="mt-6 flex justify-center">
                      <ButtonLink
                        href={`/u/${profile.username}?cursor=${posts.nextCursor}`}
                        variant="secondary"
                      >
                        Load more
                      </ButtonLink>
                    </div>
                  )}
                </>
              ))}

            {view !== 'posts' &&
              (connections.length === 0 ? (
                <p className="text-ink-muted py-12 text-center text-sm">
                  {view === 'followers' ? 'No followers yet.' : 'Not following anyone yet.'}
                </p>
              ) : (
                <ul className="max-w-md space-y-1">
                  {connections.map((account) => (
                    <li key={account.id}>
                      <AccountRow account={account} />
                    </li>
                  ))}
                </ul>
              ))}
          </div>

          {tagged.length > 0 && (
            <section className="mt-10">
              <h2 className="text-ink text-sm font-semibold">Worn by the community</h2>
              <p className="text-ink-muted mt-0.5 text-sm">Posts that tag {profile.displayName}.</p>
              <div className="mt-4">
                <PostGrid posts={tagged} />
              </div>
            </section>
          )}
        </>
      )}
    </PageContainer>
  )
}
