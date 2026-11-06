import Link from 'next/link'
import { PAGE_SIZE } from '@/config/app'
import { OCCASIONS, OCCASION_LABELS, type Occasion } from '@/config/wardrobe'
import { requireOnboardedUser } from '@/lib/auth'
import { exploreFeed, followingFeed } from '@/lib/community/posts'
import { getDb } from '@/lib/db'
import { searchAccounts, suggestedAccounts } from '@/lib/profiles/repository'
import { countItems } from '@/lib/wardrobe/repository'
import { cn } from '@/lib/utils/cn'
import { PageContainer } from '@/components/layout/PageContainer'
import { PostCard } from '@/components/community/PostCard'
import { AccountRow } from '@/components/community/AccountRow'
import { ButtonLink } from '@/components/ui/Button'

export const metadata = { title: 'Home' }

/**
 * Home: the Following and Explore feeds, newest first. No ranking in v1.
 * Server-rendered with "Load more" links, so it works without JavaScript.
 */
export default async function HomePage({ searchParams }: PageProps<'/home'>) {
  const session = await requireOnboardedUser('/home')
  const params = await searchParams
  const tab = params.tab === 'explore' ? 'explore' : 'following'
  const occasion = OCCASIONS.includes(params.occasion as Occasion)
    ? (params.occasion as Occasion)
    : null
  const cursor = typeof params.cursor === 'string' ? params.cursor : null
  const query = typeof params.q === 'string' ? params.q.slice(0, 60) : ''

  const db = await getDb()
  const [feed, suggestions, itemCount, results] = await Promise.all([
    tab === 'explore'
      ? exploreFeed(db, session.id, { cursor, limit: PAGE_SIZE.feed, occasion })
      : followingFeed(db, session.id, { cursor, limit: PAGE_SIZE.feed }),
    suggestedAccounts(db, session.id, 5),
    countItems(db, session.id),
    query ? searchAccounts(db, query, session.id) : Promise.resolve([]),
  ])

  const href = (next: Record<string, string | null>) => {
    const search = new URLSearchParams()
    const merged = { tab, occasion, ...next }
    for (const [key, value] of Object.entries(merged)) if (value) search.set(key, value)
    return `/home?${search.toString()}`
  }

  return (
    <PageContainer width="wide">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <h1 className="text-ink text-2xl font-semibold tracking-tight">Home</h1>
            <ButtonLink href="/create" size="sm">
              New post
            </ButtonLink>
          </div>

          <div className="border-line mt-5 flex gap-1 border-b" role="tablist">
            {(['following', 'explore'] as const).map((value) => (
              <Link
                key={value}
                href={value === 'following' ? '/home' : '/home?tab=explore'}
                role="tab"
                aria-selected={tab === value}
                className={cn(
                  '-mb-px border-b-2 px-3 py-2.5 text-sm',
                  tab === value
                    ? 'border-ink text-ink font-semibold'
                    : 'text-ink-muted hover:text-ink border-transparent font-medium',
                )}
              >
                {value === 'following' ? 'Following' : 'Explore'}
              </Link>
            ))}
          </div>

          {tab === 'explore' && (
            <nav aria-label="Filter by occasion" className="mt-4 flex flex-wrap gap-1.5">
              <Link
                href={href({ occasion: null, cursor: null })}
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs font-medium',
                  !occasion
                    ? 'border-ink bg-ink text-primary-ink'
                    : 'border-line-strong text-ink-muted hover:text-ink',
                )}
              >
                All
              </Link>
              {OCCASIONS.map((value) => (
                <Link
                  key={value}
                  href={href({ occasion: value, cursor: null })}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium',
                    occasion === value
                      ? 'border-ink bg-ink text-primary-ink'
                      : 'border-line-strong text-ink-muted hover:text-ink',
                  )}
                >
                  {OCCASION_LABELS[value]}
                </Link>
              ))}
            </nav>
          )}

          {feed.posts.length === 0 ? (
            <div className="border-line mt-6 rounded-2xl border border-dashed px-6 py-14 text-center">
              {tab === 'following' ? (
                <>
                  <h2 className="text-ink text-lg font-semibold">Your feed is quiet for now</h2>
                  <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm leading-relaxed">
                    Follow people whose style you like and their outfits show up here. Your wardrobe
                    works on its own too, even if you never post.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <ButtonLink href="/home?tab=explore">Explore outfits</ButtonLink>
                    <ButtonLink href="/wardrobe" variant="secondary">
                      {itemCount === 0 ? 'Start your wardrobe' : 'Open your wardrobe'}
                    </ButtonLink>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-ink text-lg font-semibold">
                    No posts {occasion ? `for ${OCCASION_LABELS[occasion].toLowerCase()} ` : ''}yet
                  </h2>
                  <p className="text-ink-muted mx-auto mt-2 max-w-md text-sm">
                    Be the first to share an outfit.
                  </p>
                  <ButtonLink href="/create" className="mt-6">
                    Share an outfit
                  </ButtonLink>
                </>
              )}
            </div>
          ) : (
            <>
              <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {feed.posts.map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} signedIn />
                  </li>
                ))}
              </ul>
              {feed.nextCursor && (
                <div className="mt-8 flex justify-center">
                  <ButtonLink href={href({ cursor: feed.nextCursor })} variant="secondary">
                    Load more
                  </ButtonLink>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="space-y-6">
          <form action="/home" method="get" role="search">
            <input type="hidden" name="tab" value={tab} />
            <label htmlFor="people-search" className="text-ink text-sm font-semibold">
              Find people and brands
            </label>
            <input
              id="people-search"
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Name or @username"
              className="border-line-strong bg-surface text-ink placeholder:text-ink-subtle mt-2 h-10 w-full rounded-lg border px-3 text-sm"
            />
          </form>

          {query && (
            <section aria-label="Search results">
              {results.length === 0 ? (
                <p className="text-ink-muted text-sm">No one matches “{query}”.</p>
              ) : (
                <ul className="space-y-1">
                  {results.map((account) => (
                    <li key={account.id}>
                      <AccountRow account={account} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {suggestions.length > 0 && (
            <section>
              <h2 className="text-ink text-sm font-semibold">Accounts to follow</h2>
              <ul className="mt-2 space-y-1">
                {suggestions.map((account) => (
                  <li key={account.id}>
                    <AccountRow account={account} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </PageContainer>
  )
}
