import Link from 'next/link'
import { MediaImage } from '@/components/media/MediaImage'
import { Avatar } from '@/components/ui/Avatar'
import { formatCount, formatRelativeTime } from '@/lib/utils/format'
import type { PostView } from '@/types/community'
import { LikeButton } from './LikeButton'
import { VerifiedBadge } from './VerifiedBadge'

/** A post in a feed or grid. */
export function PostCard({ post, signedIn }: { post: PostView; signedIn: boolean }) {
  const cover = post.images[0]
  return (
    <article className="border-line bg-surface overflow-hidden rounded-2xl border">
      <header className="flex items-center gap-3 px-4 py-3">
        <Link href={`/u/${post.author.username}`} className="flex min-w-0 items-center gap-2.5">
          <Avatar name={post.author.displayName} mediaId={post.author.avatarMediaId} size="sm" />
          <span className="min-w-0">
            <span className="text-ink flex items-center gap-1 truncate text-sm font-semibold">
              {post.author.displayName}
              {post.author.verified && <VerifiedBadge />}
            </span>
            <span className="text-ink-subtle block truncate text-xs">
              @{post.author.username} · {formatRelativeTime(post.createdAt)}
            </span>
          </span>
        </Link>
      </header>

      <Link href={`/p/${post.id}`} className="bg-surface-sunken relative block aspect-[4/5]">
        {cover && (
          <MediaImage
            id={cover.mediaId}
            alt={cover.altText || `Outfit by @${post.author.username}`}
          />
        )}
        {post.images.length > 1 && (
          <span className="bg-ink/70 text-primary-ink absolute top-3 right-3 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            1/{post.images.length}
          </span>
        )}
      </Link>

      <div className="px-4 pt-2 pb-4">
        <div className="-ml-2 flex items-center gap-1">
          <LikeButton
            postId={post.id}
            initialLiked={post.likedByViewer}
            initialCount={post.likeCount}
            signedIn={signedIn}
          />
          <Link
            href={`/p/${post.id}#comments`}
            className="text-ink-muted hover:text-ink inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.1A8 8 0 1 1 20 12Z" />
            </svg>
            <span className="tabular-nums">{formatCount(post.commentCount)}</span>
            <span className="sr-only">comments</span>
          </Link>
        </div>
        {post.caption && (
          <p className="text-ink mt-1 line-clamp-2 text-sm leading-relaxed">
            <Link href={`/u/${post.author.username}`} className="font-semibold">
              {post.author.username}
            </Link>{' '}
            {post.caption}
          </p>
        )}
        {post.brands.length > 0 && (
          <p className="text-ink-subtle mt-1.5 truncate text-xs">
            With{' '}
            {post.brands.map((brand, index) => (
              <span key={brand.id}>
                {index > 0 && ', '}
                <Link
                  href={`/u/${brand.username}`}
                  className="text-ink-muted hover:text-ink font-medium"
                >
                  {brand.displayName}
                </Link>
              </span>
            ))}
          </p>
        )}
      </div>
    </article>
  )
}
