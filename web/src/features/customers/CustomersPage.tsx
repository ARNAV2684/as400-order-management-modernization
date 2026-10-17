import { useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Plus, SearchX, Users } from "lucide-react"
import { useNavigate } from "react-router"
import { toast } from "sonner"

import { useCustomers } from "@/api/hooks/customers"
import { useBackendStatus } from "@/api/hooks/system"
import type { Customer, Status } from "@/api/types"
import { DataTable } from "@/components/data/DataTable"
import { EmptyState } from "@/components/data/EmptyState"
import { Pagination } from "@/components/data/Pagination"
import { RowActions } from "@/components/data/RowActions"
import { SearchInput } from "@/components/data/SearchInput"
import { SegmentedFilter } from "@/components/data/SegmentedFilter"
import { StatusBadge } from "@/components/data/StatusBadge"
import { GreenScreen } from "@/components/green-screen/GreenScreen"
import { CUSTOMER_LIST } from "@/components/green-screen/screens"
import { ScreenToggle } from "@/components/green-screen/ScreenToggle"
import { useScreenView } from "@/components/green-screen/use-screen-view"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { useHotkey } from "@/lib/hotkeys"
import { useListParams } from "@/lib/use-list-params"

import { CustomerFormSheet } from "./CustomerFormSheet"
import { DeleteCustomerDialog } from "./DeleteCustomerDialog"

const PAGE_SIZE = 20
type StatusFilter = "all" | Status

/** Customer list. Replaces CUSTPGM's subfile (CUSTSFL) with search instead of position-to. */
export function CustomersPage() {
  const navigate = useNavigate()
  const writesOk = useBackendStatus() === "ok"
  const { values, page, set } = useListParams(["q", "status", "new"] as const)
  const [is5250, setIs5250] = useScreenView()
  const status = (values.status === "A" || values.status === "I" ? values.status : "all") as StatusFilter

  const query = { q: values.q, status: status === "all" ? undefined : status, page, size: PAGE_SIZE }
  const { data, error, isPending, isFetching, refetch } = useCustomers(query)

  const [sheet, setSheet] = useState<{ open: boolean; customer?: Customer }>({ open: false })
  // ?new=1 (from the command palette) opens the "New" panel, like Alt+N.
  const wantsNew = values.new === "1"
  const sheetOpen = sheet.open || wantsNew
  // Set when a save navigates away, so closing the panel doesn't also rewrite the URL back to the list.
  const savedAway = useRef(false)
  useHotkey("alt+n", () => setSheet({ open: true }), { enabled: writesOk && !sheetOpen })
  const [toDelete, setToDelete] = useState<Customer | null>(null)

  const columns = useMemo<ColumnDef<Customer>[]>(
    () => [
      {
        accessorKey: "custNo",
        header: "No.",
        cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue<number>()}</span>,
        meta: { className: "w-24" },
      },
      {
        accessorKey: "name",
        header: "Name",
        cell: ({ getValue }) => <span className="font-medium">{getValue<string>()}</span>,
      },
      {
        id: "location",
        header: "City",
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.city}
            <span className="hidden lg:inline">{row.original.state && `, ${row.original.state}`}</span>
          </span>
        ),
        meta: { className: "hidden md:table-cell" },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ getValue }) => <StatusBadge status={getValue<Status>()} />,
        meta: { className: "w-28" },
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row }) => (
          <RowActions
            label={row.original.name}
            writesDisabled={!writesOk}
            onView={() => navigate(`/customers/${row.original.custNo}`)}
            onEdit={() => setSheet({ open: true, customer: row.original })}
            onDelete={() => setToDelete(row.original)}
          />
        ),
        meta: { className: "w-12", align: "right" },
      },
    ],
    [navigate, writesOk],
  )

  const filtered = Boolean(values.q) || status !== "all"

  return (
    <Page
      title="Customers"
      description="Customer master records (CSTMST)."
      actions={
        <>
          <ScreenToggle on={is5250} onChange={setIs5250} />
          <Button onClick={() => setSheet({ open: true })} disabled={!writesOk}>
            <Plus />
            New customer
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          label="Search customers"
          placeholder="Search by number or name"
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
      </div>

      {is5250 ? (
        <GreenScreen
          key={page}
          screen={CUSTOMER_LIST}
          rows={data?.items}
          ctx={{ user: "WEB" }}
          hasNext={data ? data.page * data.size < data.total : false}
          hasPrev={page > 1}
          loading={isPending || isFetching}
          onNextPage={() => set({ page: page + 1 })}
          onPrevPage={() => set({ page: page - 1 })}
          onOpen={(c) => navigate(`/customers/${c.custNo}`)}
          onExit={() => setIs5250(false)}
        />
      ) : (
        <DataTable
          columns={columns}
          data={data?.items}
          getRowId={(c) => String(c.custNo)}
          isLoading={isPending}
          isFetching={isFetching}
          error={error}
          onRetry={() => void refetch()}
          onRowClick={(c) => navigate(`/customers/${c.custNo}`)}
          rowLabel={(c) => `Open customer ${c.custNo} ${c.name}`}
          empty={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="No customers match"
                description="Try another name or number, or clear the filters."
                action={
                  <Button variant="outline" size="sm" onClick={() => set({ q: null, status: null })}>
                    Clear filters
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Users}
                title="No customers yet"
                description="Add the first one to start taking orders."
              />
            )
          }
          footer={
            data && data.total > 0 ? (
              <Pagination
                page={data.page}
                size={data.size}
                total={data.total}
                noun="customers"
                onPageChange={(p) => set({ page: p })}
              />
            ) : null
          }
        />
      )}

      <CustomerFormSheet
        open={sheetOpen}
        customer={wantsNew ? undefined : sheet.customer}
        onOpenChange={(open) => {
          if (!open && wantsNew && !savedAway.current) set({ new: null, page })
          setSheet((s) => ({ ...s, open }))
        }}
        onSaved={(custNo, message) => {
          toast.success(message, { description: `Customer ${custNo}` })
          if (wantsNew || !sheet.customer) {
            savedAway.current = true
            navigate(`/customers/${custNo}`)
          }
        }}
      />
      <DeleteCustomerDialog
        customer={toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        onDone={(message) => toast.success(message, { description: `Customer ${toDelete?.custNo}` })}
      />
    </Page>
  )
}
