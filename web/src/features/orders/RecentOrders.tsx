import { ChevronRight } from "lucide-react"
import { Link } from "react-router"

import { useOrders } from "@/api/hooks/orders"
import { Money } from "@/components/data/Money"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/dates"

/** A customer's latest orders, for the customer detail page (handoff §6.5). */
export function RecentOrders({ custNo, limit = 5 }: { custNo: number; limit?: number }) {
  const { data, isPending, error } = useOrders({ custNo, sort: "-orderDate", size: limit })

  if (isPending)
    return (
      <div className="space-y-2" aria-busy="true">
        {Array.from({ length: 2 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    )
  if (error || data.items.length === 0) return null

  return (
    <ul className="-mx-2 divide-y">
      {data.items.map((o) => (
        <li key={o.ordNo}>
          <Link
            to={`/orders/${o.ordNo}`}
            className="group flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-accent"
          >
            <span className="num font-medium text-primary">{o.ordNo}</span>
            <span className="num text-xs text-muted-foreground">{formatDate(o.orderDate)}</span>
            <Money value={o.total} className="ml-auto" />
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </li>
      ))}
    </ul>
  )
}
