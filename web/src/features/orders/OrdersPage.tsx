import { useMemo, useState } from "react"
import type { ColumnDef, SortingState } from "@tanstack/react-table"
import { Eye, Plus, ReceiptText } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { useOrders } from "@/api/hooks/orders"
import { useBackendStatus, useMessages } from "@/api/hooks/system"
import type { OrderSort, OrderSortField, OrderSummary } from "@/api/types"
import { CopyNumber } from "@/components/data/CopyNumber"
import { CustomerCombobox } from "@/components/data/CustomerCombobox"
import { DataTable } from "@/components/data/DataTable"
import { EmptyState } from "@/components/data/EmptyState"
import { Money } from "@/components/data/Money"
import { Pagination } from "@/components/data/Pagination"
import { RowActions } from "@/components/data/RowActions"
import { SegmentedFilter } from "@/components/data/SegmentedFilter"
import { MessageId } from "@/components/data/StatusBadge"
import { GreenScreen } from "@/components/green-screen/GreenScreen"
import { ORDER_LIST } from "@/components/green-screen/screens"
import { ScreenToggle } from "@/components/green-screen/ScreenToggle"
import { useScreenView } from "@/components/green-screen/use-screen-view"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { useHotkey } from "@/lib/hotkeys"
import { useListParams } from "@/lib/use-list-params"

import { DeleteOrderDialog } from "./DeleteOrderDialog"
import { OrderPeek } from "./OrderPeek"

const PAGE_SIZE = 20
const DEFAULT_SORT: OrderSort = "-ordNo"
const SORTABLE: OrderSortField[] = ["ordNo", "orderDate", "custNo", "total"]

/** "-total" ↔ [{id:"total", desc:true}] so the table header and the URL agree. */
function toSorting(sort: string): SortingState {
  const id = sort.replace(/^-/, "")
  return SORTABLE.includes(id as OrderSortField)
    ? [{ id, desc: sort.startsWith("-") }]
    : toSorting(DEFAULT_SORT)
}
/** Saved views, Shopify-style: each is just a sort the API already supports. */
const VIEWS: { value: OrderSort; label: string }[] = [
  { value: "-ordNo", label: "Newest" },
  { value: "ordNo", label: "Oldest" },
  { value: "-total", label: "Highest value" },
  { value: "total", label: "Smallest" },
]

const fromSorting = (s: SortingState): OrderSort =>
  s[0] ? (`${s[0].desc ? "-" : ""}${s[0].id}` as OrderSort) : DEFAULT_SORT

/** Order list. Replaces ORDPGM's order subfile; the customer filter is the green screen's Customer No search (D3). */
export function OrdersPage() {
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const noOrdersText = useMessages().data?.find((m) => m.id === "COM0037")?.text ?? "No orders found."
  const { values, page, set } = useListParams(["custNo", "sort"] as const)
  const [is5250, setIs5250] = useScreenView()
  const custNo = Number(values.custNo) || null
  const sorting = toSorting(values.sort || DEFAULT_SORT)
  const sort = fromSorting(sorting)

  const { data, error, isPending, isFetching, refetch } = useOrders({
    custNo: custNo ?? undefined,
    sort,
    page,
    size: PAGE_SIZE,
  })
  const [toDelete, setToDelete] = useState<OrderSummary | null>(null)
  const [peek, setPeek] = useState<number | null>(null)
  useHotkey("alt+n", () => navigate("/orders/new"), { enabled: writesOk })

  const columns = useMemo<ColumnDef<OrderSummary>[]>(
    () => [
      {
        id: "ordNo",
        accessorKey: "ordNo",
        header: "Order",
        cell: ({ getValue }) => {
          const no = getValue<number>()
          return (
            <span className="group/no inline-flex items-center gap-1">
              <span className="num font-medium text-primary">{no}</span>
              <span className="flex opacity-0 transition-opacity group-hover/no:opacity-100 focus-within:opacity-100 [tr:hover_&]:opacity-100">
                <button
                  type="button"
                  aria-label={`Peek at order ${no}`}
                  title="Peek"
                  onClick={(e) => {
                    e.stopPropagation()
                    setPeek(no)
                  }}
                  className="inline-grid size-6 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  <Eye className="size-3.5" />
                </button>
                <CopyNumber value={no} label={`order number ${no}`} />
              </span>
            </span>
          )
        },
        meta: { className: "w-36" },
      },
      {
        id: "orderDate",
        accessorKey: "orderDate",
        header: "Date",
        cell: ({ getValue }) => <span className="num">{formatDate(getValue<string>())}</span>,
        meta: { className: "w-32" },
      },
      {
        id: "custNo",
        accessorKey: "custNo",
        header: "Cust.",
        cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue<number>()}</span>,
        meta: { className: "hidden w-24 sm:table-cell" },
      },
      {
        id: "customerName",
        accessorKey: "customerName",
        header: "Customer",
        enableSorting: false,
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        id: "lineCount",
        accessorKey: "lineCount",
        header: "Lines",
        enableSorting: false,
        cell: ({ getValue }) => <span className="num">{getValue<number>()}</span>,
        meta: { align: "right", className: "hidden w-20 md:table-cell" },
      },
      {
        id: "total",
        accessorKey: "total",
        header: "Total",
        cell: ({ getValue }) => <Money value={getValue<string>()} className="font-medium" />,
        meta: { align: "right", className: "w-36" },
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            label={`order ${row.original.ordNo}`}
            writesDisabled={!writesOk}
            onView={() => navigate(`/orders/${row.original.ordNo}`)}
            onEdit={() => navigate(`/orders/${row.original.ordNo}/edit`)}
            onDelete={() => setToDelete(row.original)}
          />
        ),
        meta: { className: "w-12", align: "right" },
      },
    ],
    [navigate, writesOk],
  )

  return (
    <Page
      title="Orders"
      description="Every order header, with its customer and total."
      actions={
        <>
          <ScreenToggle on={is5250} onChange={setIs5250} />
          <Button onClick={() => navigate("/orders/new")} disabled={!writesOk}>
            <Plus />
            New order
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <SegmentedFilter
          label="Order view"
          value={VIEWS.some((v) => v.value === sort) ? sort : "-ordNo"}
          onChange={(v) => set({ sort: v === DEFAULT_SORT ? null : v })}
          options={VIEWS}
        />
        <CustomerCombobox
          value={custNo}
          onChange={(no) => set({ custNo: no })}
          placeholder="All customers"
          aria-label="Filter orders by customer"
          clearable
          className="sm:w-80"
        />
        {custNo && data && (
          <p className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? "order" : "orders"} for this customer
          </p>
        )}
      </div>

      {is5250 ? (
        <GreenScreen
          key={page}
          screen={ORDER_LIST}
          rows={data?.items}
          ctx={{ user: "WEB", custNo }}
          hasNext={data ? data.page * data.size < data.total : false}
          hasPrev={page > 1}
          loading={isPending || isFetching}
          onNextPage={() => set({ page: page + 1 })}
          onPrevPage={() => set({ page: page - 1 })}
          onOpen={(o) => navigate(`/orders/${o.ordNo}`)}
          onExit={() => setIs5250(false)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items}
          getRowId={(o) => String(o.ordNo)}
          isLoading={isPending}
          isFetching={isFetching}
          error={error}
          onRetry={() => void refetch()}
          sorting={sorting}
          onSortingChange={(updater) => {
            const next = typeof updater === "function" ? updater(sorting) : updater
            const s = fromSorting(next)
            set({ sort: s === DEFAULT_SORT ? null : s })
          }}
          onRowClick={(o) => navigate(`/orders/${o.ordNo}`)}
          rowLabel={(o) => `Open order ${o.ordNo} for ${o.customerName}`}
          empty={
            <EmptyState
              icon={ReceiptText}
              title={noOrdersText}
              description={
                custNo ? (
                  <span className="inline-flex flex-wrap items-center justify-center gap-2">
                    This customer has no orders. <MessageId id="COM0037" />
                  </span>
                ) : (
                  <MessageId id="COM0037" />
                )
              }
              action={
                custNo ? (
                  <Button variant="outline" size="sm" onClick={() => set({ custNo: null })}>
                    Show all orders
                  </Button>
                ) : undefined
              }
            />
          }
          footer={
            data && data.total > 0 ? (
              <>
                <PageTotal orders={data.items} />
                <Pagination
                  page={data.page}
                  size={data.size}
                  total={data.total}
                  noun="orders"
                  onPageChange={(p) => set({ page: p })}
                />
              </>
            ) : null
          }
        />
      )}

      <OrderPeek ordNo={peek} onClose={() => setPeek(null)} />

      <DeleteOrderDialog
        order={toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDone={(message) => toast.success(message)}
      />
    </Page>
  )
}

/** Ledger-style total of the rows on screen, double-ruled like the bottom line of an account. */
function PageTotal({ orders }: { orders: OrderSummary[] }) {
  const cents = orders.reduce((sum, o) => sum + Math.round(Number(o.total) * 100), 0)
  return (
    <div className="flex items-baseline justify-end gap-4 border-t px-4 py-3 text-sm">
      <span className="num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Total of {orders.length} {orders.length === 1 ? "order" : "orders"} shown
      </span>
      <Money
        value={(cents / 100).toFixed(2)}
        className="border-b-[3px] border-double border-foreground/70 pb-0.5 font-semibold"
      />
      <span aria-hidden className="w-8" />
    </div>
  )
}
