import type { ReactNode } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

/** Label / value pairs for a detail card. Empty values show an en dash so the grid never collapses. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: ReactNode; wide?: boolean }[]
  className?: string
}) {
  return (
    <dl className={cn("grid gap-x-8 gap-y-5 sm:grid-cols-2", className)}>
      {items.map(({ label, value, wide }) => (
        <div key={label} className={cn("min-w-0", wide && "sm:col-span-2")}>
          <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
          <dd className="mt-1 text-sm break-words">{value === "" || value == null ? "–" : value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function Card({
  title,
  children,
  className,
}: {
  title?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("rounded-lg border bg-card p-5 sm:p-6", className)}>
      {title && <h2 className="mb-5 text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  )
}

/** Number tile for a detail page's side card. */
export function Stat({ label, value, children }: { label: string; value: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 num text-3xl font-semibold tracking-tight">{value}</p>
      {children && <div className="mt-3 text-sm">{children}</div>}
    </div>
  )
}

/** Placeholder while a detail record loads. */
export function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <Skeleton className="h-3.5 w-20" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-64" />
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Skeleton className="h-56 rounded-xl" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  )
}
