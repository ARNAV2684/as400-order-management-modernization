import { ArrowUpRight, Pencil } from "lucide-react"
import { Link } from "react-router"

import { useOrder } from "@/api/hooks/orders"
import { useBackendStatus } from "@/api/hooks/system"
import { CopyNumber } from "@/components/data/CopyNumber"
import { ErrorState } from "@/components/data/ErrorState"
import { Money } from "@/components/data/Money"
import { OrderStatusBadge } from "@/components/data/StatusBadge"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate } from "@/lib/dates"
import { formatCount } from "@/lib/money"

/** Quick look at an order from the list (lines + total) without leaving it. */
export function OrderPeek({ ordNo, onClose }: { ordNo: number | null; onClose: () => void }) {
  const { data: order, error, isPending, refetch } = useOrder(ordNo ?? 0)
  const writesOk = useBackendStatus() === "ok"

  return (
    <Sheet open={ordNo !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b px-6 pt-6 pb-5">
          <p className="num text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Order peek
          </p>
          <SheetTitle className="flex items-center gap-2 text-2xl">
            <span className="num">{ordNo}</span>
            {ordNo !== null && <CopyNumber value={ordNo} label={`order number ${ordNo}`} />}
            {order && <OrderStatusBadge status={order.status} />}
          </SheetTitle>
          <SheetDescription>
            {order ? (
              <>
                {order.customerName} · <span className="num">{formatDate(order.orderDate)}</span>
              </>
            ) : (
              "Loading the order…"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isPending && ordNo !== null ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : error ? (
            <ErrorState error={error} onRetry={() => void refetch()} />
          ) : order ? (
            <>
              <ol className="divide-y divide-dashed">
                {order.lines.map((l) => (
                  <li key={l.lineNo} className="flex items-baseline gap-3 py-3 text-sm">
                    <span className="w-5 num text-[11px] text-muted-foreground">{l.lineNo}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{l.description}</span>
                      <span className="num text-[11px] text-muted-foreground">
                        {l.itemNo} · {formatCount(l.qty)} × <Money value={l.price} />
                      </span>
                    </span>
                    <Money value={l.amount} className="text-[13px]" />
                  </li>
                ))}
              </ol>
              <div className="mt-2 flex items-baseline justify-between border-t-2 border-foreground/80 pt-3">
                <span className="text-sm font-medium">Total</span>
                <Money value={order.total} className="text-2xl font-semibold display" />
              </div>
            </>
          ) : null}
        </div>

        {order && (
          <div className="flex gap-2 border-t px-6 py-4">
            <Button asChild className="flex-1">
              <Link to={`/orders/${order.ordNo}`}>
                Open order <ArrowUpRight />
              </Link>
            </Button>
            {writesOk && (
              <Button asChild variant="outline">
                <Link to={`/orders/${order.ordNo}/edit`}>
                  <Pencil /> Edit
                </Link>
              </Button>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
