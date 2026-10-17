import { useDeleteOrder } from "@/api/hooks/orders"
import type { OrderSummary } from "@/api/types"
import { DeleteDialog } from "@/components/data/DeleteDialog"
import { Money } from "@/components/data/Money"
import { formatDate } from "@/lib/dates"

interface Props {
  order: OrderSummary | null
  onOpenChange: (open: boolean) => void
  onDone: (message: string) => void
}

/** ORDSVC 'DL' (the 5250's F7 on the order list): header, lines, stock and audit row in one commit. */
export function DeleteOrderDialog({ order, onOpenChange, onDone }: Props) {
  const del = useDeleteOrder()

  return (
    <DeleteDialog
      open={order !== null}
      onOpenChange={onOpenChange}
      noun="order"
      recordLabel={order ? `Order ${order.ordNo}` : ""}
      details={
        order && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 rounded-lg border bg-muted/40 px-4 py-3 text-sm">
            <dt className="text-muted-foreground">Customer</dt>
            <dd className="truncate">
              <span className="num">{order.custNo}</span> · {order.customerName}
            </dd>
            <dt className="text-muted-foreground">Date</dt>
            <dd className="num">{formatDate(order.orderDate)}</dd>
            <dt className="text-muted-foreground">Lines</dt>
            <dd className="num">{order.lineCount}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd>
              <Money value={order.total} />
            </dd>
          </dl>
        )
      }
      warning="Stock will be returned for every line, and the audit log records the delete."
      onDelete={() => del.mutateAsync(order!.ordNo)}
      onDone={(message) => onDone(message)}
    />
  )
}
