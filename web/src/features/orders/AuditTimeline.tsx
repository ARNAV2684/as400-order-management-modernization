import { History } from "lucide-react"

import { useOrderAudit } from "@/api/hooks/orders"
import { ErrorState } from "@/components/data/ErrorState"
import { AuditActionBadge, SourceChip } from "@/components/data/StatusBadge"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDateTime } from "@/lib/dates"
import { cn } from "@/lib/utils"

const DOT = { A: "bg-success", U: "bg-info", D: "bg-danger" } as const

/** ORDAUD rows for one order, newest first. Shows who changed it, when, and from which channel. */
export function AuditTimeline({ ordNo }: { ordNo: number }) {
  const { data, error, isPending, refetch } = useOrderAudit(ordNo)

  if (isPending)
    return (
      <div className="space-y-4" aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="mt-1 size-2.5 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-40" />
            </div>
          </div>
        ))}
      </div>
    )

  if (error) return <ErrorState error={error} onRetry={() => void refetch()} />

  if (data.length === 0)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <History className="size-4" /> No audit rows for this order.
      </p>
    )

  return (
    <ol className="relative">
      {data.map((a, i) => (
        <li key={`${a.at}-${a.action}-${i}`} className="relative flex gap-3 pb-5 last:pb-0">
          {i < data.length - 1 && (
            <span aria-hidden className="absolute top-3 bottom-0 left-[4.5px] w-px bg-border" />
          )}
          <span
            aria-hidden
            className={cn("relative mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-card", DOT[a.action])}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <AuditActionBadge action={a.action} />
              <SourceChip source={a.source} />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              <span className="num">{formatDateTime(a.at)}</span> · by <span className="num">{a.user}</span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
