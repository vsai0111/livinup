import { Skeleton } from '@/components/ui/Skeleton'

/**
 * Route-level loading state.
 *
 * Mirrors the shape of a product grid so the layout does not jump when real
 * content arrives.
 */
export default function Loading() {
  return (
    <div className="space-y-10">
      <div className="space-y-2.5">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>

      <div className="space-y-5">
        <Skeleton className="h-5 w-40" />
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="border-line space-y-2.5 overflow-hidden rounded-[var(--radius-card)] border p-0"
            >
              <Skeleton className="aspect-4/5 w-full rounded-none" />
              <div className="space-y-2 p-3.5 pt-0">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="sr-only" role="status">
        Loading products
      </p>
    </div>
  )
}
