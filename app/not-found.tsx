import { ButtonLink } from '@/components/ui/Button'

export const metadata = { title: 'Page not found' }

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center px-5 text-center">
      <p className="text-ink-subtle font-mono text-xs font-medium">404</p>
      <h1 className="text-ink mt-3 text-2xl font-semibold">We could not find that</h1>
      <p className="text-ink-muted mt-2.5 text-sm leading-relaxed">
        The page or product you were looking for does not exist, or is no longer stocked.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2.5">
        <ButtonLink href="/home">Back to your feed</ButtonLink>
        <ButtonLink href="/search" variant="secondary">
          Search products
        </ButtonLink>
      </div>
    </div>
  )
}
