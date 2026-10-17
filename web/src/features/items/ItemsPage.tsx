import { useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Boxes, Plus, SearchX } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { useItems } from "@/api/hooks/items"
import { useBackendStatus } from "@/api/hooks/system"
import type { Item, Status } from "@/api/types"
import { DataTable } from "@/components/data/DataTable"
import { EmptyState } from "@/components/data/EmptyState"
import { Money } from "@/components/data/Money"
import { Pagination } from "@/components/data/Pagination"
import { RowActions } from "@/components/data/RowActions"
import { SearchInput } from "@/components/data/SearchInput"
import { SegmentedFilter } from "@/components/data/SegmentedFilter"
import { StatusBadge, StockBadge } from "@/components/data/StatusBadge"
import { GreenScreen } from "@/components/green-screen/GreenScreen"
import { ITEM_LIST } from "@/components/green-screen/screens"
import { ScreenToggle } from "@/components/green-screen/ScreenToggle"
import { useScreenView } from "@/components/green-screen/use-screen-view"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatCount } from "@/lib/money"
import { useHotkey } from "@/lib/hotkeys"
import { useListParams } from "@/lib/use-list-params"

import { DeleteItemDialog } from "./DeleteItemDialog"
import { ItemFormSheet } from "./ItemFormSheet"

const PAGE_SIZE = 20
type StatusFilter = "all" | Status

/** Item list. Replaces ITEMPGM's subfile, adding price and stock at a glance. */
export function ItemsPage() {
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const { values, page, set } = useListParams(["q", "status", "inStock", "new"] as const)
  const [is5250, setIs5250] = useScreenView()
  const status = (values.status === "A" || values.status === "I" ? values.status : "all") as StatusFilter
  const inStock = values.inStock === "true"

  const query = {
    q: values.q,
    status: status === "all" ? undefined : status,
    inStock: inStock || undefined,
    page,
    size: PAGE_SIZE,
  }
  const { data, error, isPending, isFetching, refetch } = useItems(query)

  const [sheet, setSheet] = useState<{ open: boolean; item?: Item }>({ open: false })
  // ?new=1 (from the command palette) opens the "New" panel, like Alt+N.
  const wantsNew = values.new === "1"
  const sheetOpen = sheet.open || wantsNew
  // Set when a save navigates away, so closing the panel doesn't also rewrite the URL back to the list.
  const savedAway = useRef(false)
  useHotkey("alt+n", () => setSheet({ open: true }), { enabled: writesOk && !sheetOpen })
  const [toDelete, setToDelete] = useState<Item | null>(null)

  const columns = useMemo<ColumnDef<Item>[]>(
    () => [
      {
        accessorKey: "itemNo",
        header: "No.",
        cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue<number>()}</span>,
        meta: { className: "w-24" },
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: ({ getValue }) => <span className="text-muted-foreground">{getValue<string>()}</span>,
        meta: { className: "hidden lg:table-cell" },
      },
      {
        accessorKey: "unitPrice",
        header: "Unit price",
        cell: ({ getValue }) => <Money value={getValue<string>()} />,
        meta: { align: "right", className: "w-36" },
      },
      {
        accessorKey: "stockQty",
        header: "Stock",
        cell: ({ getValue }) => {
          const qty = getValue<number>()
          return (
            <span className="inline-flex items-center justify-end gap-2">
              <span className="num">{formatCount(qty)}</span>
              <StockBadge qty={qty} />
            </span>
          )
        },
        meta: { align: "right", className: "w-32" },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<Status>()} />,
        meta: { className: "hidden w-28 md:table-cell" },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            label={row.original.description}
            writesDisabled={!writesOk}
            onView={() => navigate(`/items/${row.original.itemNo}`)}
            onEdit={() => setSheet({ open: true, item: row.original })}
            onDelete={() => setToDelete(row.original)}
          />
        ),
        meta: { className: "w-12", align: "right" },
      },
    ],
    [navigate, writesOk],
  )

  const filtered = Boolean(values.q) || status !== "all" || inStock

  return (
    <Page
      title="Items"
      description="Item master records with price and stock (ITMMST)."
      actions={
        <>
          <ScreenToggle on={is5250} onChange={setIs5250} />
          <Button onClick={() => setSheet({ open: true })} disabled={!writesOk}>
            <Plus />
            New item
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          label="Search items"
          placeholder="Search number, description, category"
          value={values.q}
          onChange={(q) => set({ q })}
          className="sm:w-80"
        />
        <SegmentedFilter
          label="Filter by status"
          value={status}
          onChange={(v) => set({ status: v === "all" ? null : v })}
          options={[
            { value: "all", label: "All" },
            { value: "A", label: "Active" },
            { value: "I", label: "Inactive" },
          ]}
        />
        <div className="flex h-9 items-center gap-2 sm:ml-1">
          <Switch
            id="inStock"
            checked={inStock}
            onCheckedChange={(on) => set({ inStock: on ? "true" : null })}
          />
          <Label htmlFor="inStock" className="text-sm font-normal text-muted-foreground">
            In stock only
          </Label>
        </div>
      </div>

      {is5250 ? (
        <GreenScreen
          key={page}
          screen={ITEM_LIST}
          rows={data?.items}
          ctx={{ user: "WEB" }}
          hasNext={data ? data.page * data.size < data.total : false}
          hasPrev={page > 1}
          loading={isPending || isFetching}
          onNextPage={() => set({ page: page + 1 })}
          onPrevPage={() => set({ page: page - 1 })}
          onOpen={(i) => navigate(`/items/${i.itemNo}`)}
          onExit={() => setIs5250(false)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items}
          getRowId={(i) => String(i.itemNo)}
          isLoading={isPending}
          isFetching={isFetching}
          error={error}
          onRetry={() => void refetch()}
          onRowClick={(i) => navigate(`/items/${i.itemNo}`)}
          rowLabel={(i) => `Open item ${i.itemNo} ${i.description}`}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No items match"
                description="Try another search, or clear the filters."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => set({ q: null, status: null, inStock: null })}
                  >
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Boxes}
                title="No items yet"
                description="Add the first item to start taking orders."
              />
            )
          }
          footer={
            data && data.total > 0 ? (
              <Pagination
                page={data.page}
                size={data.size}
                total={data.total}
                noun="items"
                onPageChange={(p) => set({ page: p })}
              />
            ) : null
          }
        />
      )}

      <ItemFormSheet
        open={sheetOpen}
        item={wantsNew ? undefined : sheet.item}
        onOpenChange={(open) => {
          if (!open && wantsNew && !savedAway.current) set({ new: null, page })
          setSheet((s) => ({ ...s, open }))
        }}
        onSaved={(itemNo, message) => {
          toast.success(message, { description: `Item ${itemNo}` })
          if (wantsNew || !sheet.item) {
            savedAway.current = true
            navigate(`/items/${itemNo}`)
          }
        }}
      />
      <DeleteItemDialog
        item={toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDone={(message) => toast.success(message, { description: `Item ${toDelete?.itemNo}` })}
      />
    </Page>
  )
}
