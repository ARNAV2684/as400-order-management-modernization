import { useState } from "react"
import { PackageX, Pencil, Trash2 } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { useItem } from "@/api/hooks/items"
import { useBackendStatus } from "@/api/hooks/system"
import { Card, DetailList, DetailSkeleton, Stat } from "@/components/data/DetailList"
import { EmptyState } from "@/components/data/EmptyState"
import { ErrorState } from "@/components/data/ErrorState"
import { Money } from "@/components/data/Money"
import { LOW_STOCK, MessageId, StatusBadge, StockBadge } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { formatCount } from "@/lib/money"

import { DeleteItemDialog } from "./DeleteItemDialog"
import { ItemFormSheet } from "./ItemFormSheet"

const BACK = { to: "/items", label: "Items" }

/** One item. Replaces ITEMPGM's detail screen in DISPLAY mode (option 5). */
export function ItemDetailPage() {
  const itemNo = Number(useParams().itemNo)
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const { data: item, error, isPending, refetch } = useItem(itemNo)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (isPending) return <DetailSkeleton />

  if (error || !item) {
    const notFound = error?.status === 404
    return (
      <Page title={`Item ${itemNo}`} back={BACK} footnote="Replaces ITEMPGM · Item detail">
        <Card>
          {notFound ? (
            <EmptyState
              icon={PackageX}
              title="Item not found"
              description={
                <span className="inline-flex items-center gap-2">
                  {error.message} <MessageId id={error.id ?? "COM0013"} />
                </span>
              }
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/items">Back to items</Link>
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

  const stockNote =
    item.stockQty <= 0
      ? "Out of stock: orders for it are refused (COM0019)."
      : item.stockQty <= LOW_STOCK
        ? `Low stock: ${LOW_STOCK} or fewer left.`
        : "Enough stock for normal orders."

  return (
    <Page
      back={BACK}
      eyebrow={<span className="num text-xs text-muted-foreground">Item {item.itemNo}</span>}
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {item.description}
          <StatusBadge status={item.status} />
        </span>
      }
      footnote="Replaces ITEMPGM · Item detail (option 5)"
      actions={
        <>
          <Button variant="outline" onClick={() => setEditing(true)} disabled={!writesOk}>
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Details">
          <DetailList
            items={[
              { label: "Item number", value: <span className="num">{item.itemNo}</span> },
              { label: "Status", value: item.status === "A" ? "Active" : "Inactive (not on new orders)" },
              { label: "Description", value: item.description, wide: true },
              { label: "Category", value: item.category },
              { label: "Unit price", value: <Money value={item.unitPrice} className="text-base" /> },
            ]}
          />
        </Card>
        <div className="grid gap-4">
          <Card>
            <Stat
              label="Stock on hand"
              value={
                <span className="inline-flex items-center gap-3">
                  {formatCount(item.stockQty)}
                  <StockBadge qty={item.stockQty} />
                </span>
              }
            >
              <p className="text-muted-foreground">{stockNote}</p>
            </Stat>
          </Card>
          <Card>
            <Stat label="Order lines using it" value={item.orderLineCount}>
              <p className="text-muted-foreground">
                {item.orderLineCount > 0
                  ? "Because orders use it, it can't be deleted (COM0017). Set it Inactive instead."
                  : "Not on any order yet."}
              </p>
            </Stat>
          </Card>
        </div>
      </div>

      <ItemFormSheet
        open={editing}
        item={item}
        onOpenChange={setEditing}
        onSaved={(no, message) => toast.success(message, { description: `Item ${no}` })}
      />
      <DeleteItemDialog
        item={deleting ? item : null}
        onOpenChange={setDeleting}
        onDone={(message, deleted) => {
          toast.success(message, { description: `Item ${item.itemNo}` })
          if (deleted) navigate("/items")
        }}
      />
    </Page>
  )
}
