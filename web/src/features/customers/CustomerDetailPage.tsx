import { useState } from "react"
import { ArrowRight, Pencil, Trash2, UserX } from "lucide-react"
import { Link, useNavigate, useParams } from "react-router"
import { toast } from "sonner"

import { useCustomer } from "@/api/hooks/customers"
import { useBackendStatus } from "@/api/hooks/system"
import { Card, DetailList, DetailSkeleton, Stat } from "@/components/data/DetailList"
import { EmptyState } from "@/components/data/EmptyState"
import { ErrorState } from "@/components/data/ErrorState"
import { MessageId, StatusBadge } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"

import { RecentOrders } from "@/features/orders/RecentOrders"

import { CustomerFormSheet } from "./CustomerFormSheet"
import { DeleteCustomerDialog } from "./DeleteCustomerDialog"

const BACK = { to: "/customers", label: "Customers" }

/** One customer. Replaces CUSTPGM's detail screen in DISPLAY mode (option 5). */
export function CustomerDetailPage() {
  const custNo = Number(useParams().custNo)
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const { data: c, error, isPending, refetch } = useCustomer(custNo)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (isPending) return <DetailSkeleton />

  if (error || !c) {
    const notFound = error?.status === 404
    return (
      <Page title={`Customer ${custNo}`} back={BACK} footnote="Replaces CUSTPGM · Customer detail">
        <Card>
          {notFound ? (
            <EmptyState
              icon={UserX}
              title="Customer not found"
              description={
                <span className="inline-flex items-center gap-2">
                  {error.message} <MessageId id={error.id ?? "COM0006"} />
                </span>
              }
              action={
                <Button variant="outline" size="sm" asChild>
                  <Link to="/customers">Back to customers</Link>
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
      eyebrow={<span className="num text-xs text-muted-foreground">Customer {c.custNo}</span>}
      title={
        <span className="inline-flex flex-wrap items-center gap-3">
          {c.name}
          <StatusBadge status={c.status} />
        </span>
      }
      footnote="Replaces CUSTPGM · Customer detail (option 5)"
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
              { label: "Customer number", value: <span className="num">{c.custNo}</span> },
              { label: "Status", value: c.status === "A" ? "Active" : "Inactive (no new orders)" },
              { label: "Name", value: c.name, wide: true },
              { label: "Address", value: c.address, wide: true },
              { label: "City", value: c.city },
              { label: "State", value: c.state },
            ]}
          />
        </Card>
        <Card title="Orders">
          <Stat label="Orders on file" value={c.orderCount}>
            {c.orderCount > 0 ? (
              <>
                <p className="text-muted-foreground">
                  Because it has orders, this customer can't be deleted (COM0009). Set it Inactive instead.
                </p>
                <div className="mt-4">
                  <RecentOrders custNo={c.custNo} />
                </div>
                <Link
                  to={`/orders?custNo=${c.custNo}`}
                  className="mt-3 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  All orders for this customer <ArrowRight className="size-3.5" />
                </Link>
              </>
            ) : (
              <p className="text-muted-foreground">No orders yet.</p>
            )}
          </Stat>
        </Card>
      </div>

      <CustomerFormSheet
        open={editing}
        customer={c}
        onOpenChange={setEditing}
        onSaved={(no, message) => toast.success(message, { description: `Customer ${no}` })}
      />
      <DeleteCustomerDialog
        customer={deleting ? c : null}
        onOpenChange={setDeleting}
        onDone={(message, deleted) => {
          toast.success(message, { description: `Customer ${c.custNo}` })
          if (deleted) navigate("/customers")
        }}
      />
    </Page>
  )
}
