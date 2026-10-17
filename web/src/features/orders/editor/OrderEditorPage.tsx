import { useState } from "react"
import { FileX } from "lucide-react"
import { Link, useParams } from "react-router"

import { useOrder } from "@/api/hooks/orders"
import { Card, DetailSkeleton } from "@/components/data/DetailList"
import { EmptyState } from "@/components/data/EmptyState"
import { ErrorState } from "@/components/data/ErrorState"
import { MessageId } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"

import { draftFromOrder, emptyDraft, todayIso } from "./draft"
import { OrderEditor } from "./OrderEditor"

/** /orders/new: ORDPGM Add (F5). */
export function NewOrderPage() {
  return (
    <Page
      title="New order"
      description="Pick a customer and add lines. ORDSVC checks everything as you go; the total is its answer."
      back={{ to: "/orders", label: "Orders" }}
      footnote="Replaces ORDPGM · Add order (F5)"
    >
      <OrderEditor initial={emptyDraft(todayIso())} />
    </Page>
  )
}

/** /orders/:ordNo/edit: ORDPGM Edit (X + F6). The header is locked (A4); lines can change. */
export function EditOrderPage() {
  const ordNo = Number(useParams().ordNo)
  const { data: order, error, isPending, refetch } = useOrder(ordNo)
  // Bumped after a COM0039 reload so the editor starts again from the fresh order.
  const [generation, setGeneration] = useState(0)

  if (isPending) return <DetailSkeleton />

  if (error || !order)
    return (
      <Page title={`Edit order ${ordNo}`} back={{ to: "/orders", label: "Orders" }}>
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

  return (
    <Page
      title={
        <>
          Edit order <span className="num">{order.ordNo}</span>
        </>
      }
      description="Change quantities, delete lines or add new ones. Stock moves by the net change when you save."
      back={{ to: `/orders/${order.ordNo}`, label: `Order ${order.ordNo}` }}
      footnote="Replaces ORDPGM · Edit order (X + F6)"
    >
      <OrderEditor
        key={`${order.checksum}-${generation}`}
        initial={draftFromOrder(order)}
        customerName={order.customerName}
        onReload={() => {
          void refetch().then(() => setGeneration((g) => g + 1))
        }}
      />
    </Page>
  )
}
