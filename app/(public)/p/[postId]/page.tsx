import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { PAGE_SIZE } from '@/config/app'
import { OCCASION_LABELS, type Occasion } from '@/config/wardrobe'
import { getSessionUser } from '@/lib/auth'
import { getPost, getRemovedPostForAuthor, listComments } from '@/lib/community/posts'
import { getDb } from '@/lib/db'
import { mediaUrl } from '@/lib/media/url'
import { formatDate, humanize } from '@/lib/utils/format'
import { PageContainer } from '@/components/layout/PageContainer'
import { Comments } from '@/components/community/Comments'
import { ImageCarousel } from '@/components/community/ImageCarousel'
import { LikeButton } from '@/components/community/LikeButton'
import { PostMenu } from '@/components/community/PostMenu'
import { ShareButton } from '@/components/community/ShareButton'
import { VerifiedBadge } from '@/components/community/VerifiedBadge'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ButtonLink } from '@/components/ui/Button'

/**
 * A post. Public and read-only for visitors (spec P5): they see the photos,
 * caption and counts, but not the comments, and are invited to sign in.
 */

async function load(postId: string) {
  if (!z.string().uuid().safeParse(postId).success) return { post: null, session: null, db: null }
  const [db, session] = await Promise.all([getDb(), getSessionUser()])
  const viewer = session ? { id: session.id, role: session.profile.role } : null
  const post = await getPost(db, postId, viewer)
  return { post, session, db }
}

export async function generateMetadata({ params }: PageProps<'/p/[postId]'>): Promise<Metadata> {
  const { postId } = await params
  const { post } = await load(postId)
  if (!post || post.status !== 'published')
    return { title: 'Post not available', robots: { index: false } }
  const excerpt = post.caption.slice(0, 140) || `An outfit by @${post.author.username}`
  const cover = post.images[0]
  return {
    title: `${post.author.displayName} on LivinUp`,
    description: excerpt,
    openGraph: {
      title: `${post.author.displayName} (@${post.author.username})`,
      description: excerpt,
      type: 'article',
      images: cover
        ? [{ url: mediaUrl(cover.mediaId, 'md'), alt: cover.altText || excerpt }]
        : undefined,
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function PostPage({ params }: PageProps<'/p/[postId]'>) {
  const { postId } = await params
  const { post, session, db } = await load(postId)

  if (!post) {
    const removed = session && db ? await getRemovedPostForAuthor(db, postId, session.id) : null
    return (
      <PageContainer width="narrow">
        <div className="py-16 text-center">
          <h1 className="text-ink text-xl font-semibold">
            {removed ? 'This post was removed' : 'This post isn’t available'}
          </h1>
          <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
            {removed
              ? 'It was removed for breaking the Community Guidelines. If you think this was a mistake, contact us from the Grievances page.'
              : 'It may have been deleted, or the link may be wrong.'}
          </p>
          <ButtonLink href={session ? '/home' : '/'} variant="secondary" className="mt-6">
            {session ? 'Back to home' : 'Go to LivinUp'}
          </ButtonLink>
        </div>
      </PageContainer>
    )
  }

  const signedIn = Boolean(session?.profile.username)
  const isAuthor = session?.id === post.author.id
  const comments =
    signedIn && db ? await listComments(db, post.id, session!.id, PAGE_SIZE.comments) : []

  return (
    <PageContainer>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ImageCarousel images={post.images} fallbackAlt={`Outfit by @${post.author.username}`} />

        <div className="min-w-0">
          {post.status === 'removed' && (
            <p className="bg-surface-sunken text-negative mb-4 rounded-lg px-3 py-2 text-sm">
              Removed by moderation (visible to admins only).
            </p>
          )}
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/u/${post.author.username}?from=post`}
              className="flex min-w-0 items-center gap-3"
            >
              <Avatar name={post.author.displayName} mediaId={post.author.avatarMediaId} />
              <span className="min-w-0">
                <span className="text-ink flex items-center gap-1 truncate font-semibold">
                  {post.author.displayName}
                  {post.author.verified && <VerifiedBadge />}
                </span>
                <span className="text-ink-subtle block truncate text-sm">
                  @{post.author.username}
                </span>
              </span>
            </Link>
            <PostMenu
              postId={post.id}
              authorId={post.author.id}
              authorUsername={post.author.username}
              caption={post.caption}
              isAuthor={isAuthor}
              signedIn={signedIn}
            />
          </div>

          {post.caption && (
            <p className="text-ink mt-4 text-[15px] leading-relaxed break-words whitespace-pre-line">
              {post.caption}
            </p>
          )}

          {post.occasions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {post.occasions.map((occasion) => (
                <Link key={occasion} href={`/home?tab=explore&occasion=${occasion}`}>
                  <Badge>{OCCASION_LABELS[occasion as Occasion] ?? humanize(occasion)}</Badge>
                </Link>
              ))}
            </div>
          )}

          {post.items.length > 0 && (
            <section className="border-line mt-5 rounded-xl border p-4">
              <h2 className="text-ink text-sm font-semibold">What I’m wearing</h2>
              <ul className="mt-2 space-y-1.5">
                {post.items.map((item, index) => (
                  <li key={index} className="text-ink-muted text-sm">
                    <span className="text-ink">{item.label}</span>
                    {item.color && ` · ${humanize(item.color)}`}
                    {item.brand && ` · ${item.brand}`}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {post.brands.length > 0 && (
            <p className="text-ink-muted mt-4 text-sm">
              Brands:{' '}
              {post.brands.map((brand, index) => (
                <span key={brand.id}>
                  {index > 0 && ', '}
                  <Link
                    href={`/u/${brand.username}?from=post`}
                    className="text-ink font-medium hover:underline"
                  >
                    {brand.displayName}
                  </Link>
                </span>
              ))}
            </p>
          )}

          <div className="border-line mt-5 -ml-2 flex items-center gap-1 border-t pt-3">
            <LikeButton
              postId={post.id}
              initialLiked={post.likedByViewer}
              initialCount={post.likeCount}
              signedIn={signedIn}
            />
            <ShareButton
              path={`/p/${post.id}`}
              title={`${post.author.displayName} on LivinUp`}
              kind="post"
            />
            <span className="text-ink-subtle ml-auto text-xs">
              {formatDate(post.createdAt)}
              {post.editedAt && ' · edited'}
            </span>
          </div>

          {signedIn ? (
            <Comments
              postId={post.id}
              comments={comments}
              canComment={post.status === 'published'}
            />
          ) : (
            <div className="bg-surface-sunken mt-6 rounded-xl p-5">
              <p className="text-ink text-sm font-medium">
                {post.commentCount > 0 ? `${post.commentCount} comments` : 'Join the conversation'}
              </p>
              <p className="text-ink-muted mt-1 text-sm">
                Sign in to read comments, like and follow.
              </p>
              <div className="mt-4 flex gap-2">
                <ButtonLink href={`/signup?next=${encodeURIComponent(`/p/${post.id}`)}`} size="sm">
                  Join LivinUp
                </ButtonLink>
                <ButtonLink
                  href={`/signin?next=${encodeURIComponent(`/p/${post.id}`)}`}
                  size="sm"
                  variant="secondary"
                >
                  Sign in
                </ButtonLink>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  )
}
