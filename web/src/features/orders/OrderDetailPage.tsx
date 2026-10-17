import { useState, type ReactNode } from "react"
import { FileX, Pencil, Trash2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { useOrder } from "@/api/hooks/orders"
import { useBackendStatus } from "@/api/hooks/system"
import type { OrderDetail } from "@/api/types"
import { CopyNumber } from "@/components/data/CopyNumber"
import { Card, DetailSkeleton } from "@/components/data/DetailList"
import { EmptyState } from "@/components/data/EmptyState"
import { ErrorState } from "@/components/data/ErrorState"
import { Money } from "@/components/data/Money"
import { MessageId, OrderStatusBadge } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatDate } from "@/lib/dates"
import { formatCount } from "@/lib/money"

import { AuditTimeline } from "./AuditTimeline"
import { DeleteOrderDialog } from "./DeleteOrderDialog"

const BACK = { to: "/orders", label: "Orders" }

/** One order: header, lines and its audit trail. Replaces ORDPGM's order display (option 5). */
export function OrderDetailPage() {
  const ordNo = Number(useParams().ordNo)
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const { data: order, error, isPending, refetch } = useOrder(ordNo)
  const [deleting, setDeleting] = useState(false)

  if (isPending) return <DetailSkeleton />

  if (error || !order) {
    return (
      <Page title={`Order ${ordNo}`} back={BACK} footnote="Replaces ORDPGM · Order display">
        <Card>
          {error?.status === 404 ? (
            <EmptyState
              icon={FileX}
              title="Order not found"
              description={
                <span className="inline-flex items-center gap-2">
                  {error.message} <MessageId id={error.id ?? "COM0023"} />
                </span>
              }
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/orders">Back to orders</Link>
                </Button>
              }
            />
          ) : (
            error && <ErrorState error={error} onRetry={() => void refetch()} />
          )}
        </Card>
      </Page>
    )
  }

  return (
    <Page
      back={BACK}
      eyebrow={<span className="text-xs text-muted-foreground">Order</span>}
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          <span className="num">{order.ordNo}</span>
          <CopyNumber value={order.ordNo} label={`order number ${order.ordNo}`} />
          <OrderStatusBadge status={order.status} />
        </span>
      }
      footnote="Replaces ORDPGM · Order display (option 5)"
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => navigate(`/orders/${order.ordNo}/edit`)}
            disabled={!writesOk}
          >
            <Pencil />
            Edit
          </Button>
          <Button
            variant="outline"
            className="text-danger hover:bg-danger-soft hover:text-danger"
            onClick={() => setDeleting(true)}
            disabled={!writesOk}
          >
            <Trash2 />
            Delete
          </Button>
        </>
      }
    >
      <OrderSummaryCard order={order} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title={`Lines (${order.lines.length})`} className="p-0 sm:p-0">
          <LinesTable order={order} />
        </Card>
        <Card title="Audit trail">
          <AuditTimeline ordNo={order.ordNo} />
        </Card>
      </div>

      <DeleteOrderDialog
        order={deleting ? order : null}
        onOpenChange={setDeleting}
        onDone={(message) => {
          toast.success(message)
          navigate("/orders")
        }}
      />
    </Page>
  )
}

function OrderSummaryCard({ order }: { order: OrderDetail }) {
  const cells: { label: string; value: ReactNode }[] = [
    { label: "Order date", value: <span className="num">{formatDate(order.orderDate)}</span> },
    {
      label: "Customer",
      value: (
        <Link
          to={`/customers/${order.custNo}`}
          className="group inline-flex min-w-0 items-baseline gap-2 hover:text-primary"
        >
          <span className="num text-muted-foreground group-hover:text-primary">{order.custNo}</span>
          <span className="truncate font-medium underline-offset-4 group-hover:underline">
            {order.customerName}
          </span>
        </Link>
      ),
    },
    { label: "Lines", value: <span className="num">{order.lineCount}</span> },
    { label: "Order total", value: <Money value={order.total} className="text-lg font-semibold" /> },
  ]
  return (
    <section className="grid grid-cols-2 overflow-hidden rounded-lg border bg-card lg:grid-cols-4">
      {cells.map((c, i) => (
        <div
          key={c.label}
          className={
            "min-w-0 px-5 py-4 " +
            (i % 2 === 1 ? "border-l " : "") +
            (i >= 2 ? "border-t lg:border-t-0 " : "") +
            (i === 2 ? "lg:border-l" : "")
          }
        >
          <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
          <div className="mt-1 truncate text-sm">{c.value}</div>
        </div>
      ))}
    </section>
  )
}

/** ORDDTL rows. Description and price are copied from ITMMST when the line is saved (decision A3). */
function LinesTable({ order }: { order: OrderDetail }) {
  return (
    <Table>
      <TableHeader className="[&_tr]:border-b-foreground/60">
        <TableRow className="hover:bg-transparent">
          <TableHead className="h-10 w-14 pl-5 num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Line
          </TableHead>
          <TableHead className="h-10 w-20 num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Item
          </TableHead>
          <TableHead className="h-10 num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Description
          </TableHead>
          <TableHead className="h-10 w-16 text-right num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Qty
          </TableHead>
          <TableHead className="hidden h-10 w-32 text-right num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase sm:table-cell">
            Price
          </TableHead>
          <TableHead className="h-10 w-36 pr-5 text-right num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Amount
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {order.lines.map((l) => (
          <TableRow key={l.lineNo}>
            <TableCell className="pl-5 num text-muted-foreground">{l.lineNo}</TableCell>
            <TableCell>
              <Link to={`/items/${l.itemNo}`} className="num text-primary hover:underline">
                {l.itemNo}
              </Link>
            </TableCell>
            <TableCell className="font-medium">{l.description}</TableCell>
            <TableCell className="text-right num">{formatCount(l.qty)}</TableCell>
            <TableCell className="hidden text-right sm:table-cell">
              <Money value={l.price} className="text-muted-foreground" />
            </TableCell>
            <TableCell className="pr-5 text-right">
              <Money value={l.amount} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter className="bg-muted/30">
        <TableRow className="hover:bg-transparent">
          <TableCell
            colSpan={3}
            className="pl-5 num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase"
          >
            Total (TOTAMT)
          </TableCell>
          <TableCell colSpan={3} className="pr-5 text-right">
            <Money value={order.total} className="font-semibold" />
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  )
}
