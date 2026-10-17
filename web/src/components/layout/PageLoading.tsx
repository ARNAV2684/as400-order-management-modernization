import { Skeleton } from "@/components/ui/skeleton"

/** Shown only on the very first load while the page's chunk arrives (usually a few milliseconds). */
export function PageLoading() {
  return (
    <div
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6"
      aria-busy="true"
      aria-label="Loading"
    >
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-72" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  )
}
