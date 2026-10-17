import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { History, SearchX } from "lucide-react"
import { Link } from "react-router"

import { useAuditLog } from "@/api/hooks/insights"
import type { AuditAction, AuditEntry, AuditSource } from "@/api/types"
import { DataTable } from "@/components/data/DataTable"
import { EmptyState } from "@/components/data/EmptyState"
import { Pagination } from "@/components/data/Pagination"
import { SearchInput } from "@/components/data/SearchInput"
import { SegmentedFilter } from "@/components/data/SegmentedFilter"
import { AuditActionBadge, SourceChip } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { formatDateTime } from "@/lib/dates"
import { useListParams } from "@/lib/use-list-params"

const PAGE_SIZE = 25

const timeOf = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

/**
 * ORDAUD: one row per order add / change / delete, written by the ORDTRG trigger (Sprint 7) whichever
 * channel made the change. The source chip is what proves "one database, two front doors".
 */
export function AuditPage() {
  const { values, page, set } = useListParams(["ordNo", "action", "source", "live"] as const)
  const ordNo = Number(values.ordNo) || undefined
  const action = (["A", "U", "D"].includes(values.action) ? values.action : "all") as AuditAction | "all"
  const source = (["WEB", "5250"].includes(values.source) ? values.source : "all") as AuditSource | "all"
  const live = values.live === "1"

  const { data, error, isPending, isFetching, refetch, dataUpdatedAt } = useAuditLog(
    {
      ordNo,
      action: action === "all" ? undefined : action,
      source: source === "all" ? undefined : source,
      page,
      size: PAGE_SIZE,
    },
    live,
  )

  const columns = useMemo<ColumnDef<AuditEntry>[]>(
    () => [
      {
        accessorKey: "at",
        header: "When",
        cell: ({ getValue }) => <span className="num">{formatDateTime(getValue<string>())}</span>,
        meta: { className: "w-44" },
      },
      {
        accessorKey: "ordNo",
        header: "Order",
        cell: ({ getValue }) => (
          <Link to={`/orders/${getValue<number>()}`} className="num font-medium text-primary hover:underline">
            {getValue<number>()}
          </Link>
        ),
        meta: { className: "w-24" },
      },
      {
        accessorKey: "action",
        header: "Action",
        cell: ({ getValue }) => <AuditActionBadge action={getValue<AuditAction>()} />,
      },
      {
        accessorKey: "user",
        header: "User",
        cell: ({ getValue }) => <span className="num text-muted-foreground">{getValue<string>()}</span>,
        meta: { className: "hidden sm:table-cell" },
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ getValue }) => <SourceChip source={getValue<AuditSource>()} />,
        meta: { className: "w-24" },
      },
    ],
    [],
  )

  const filtered = Boolean(ordNo) || action !== "all" || source !== "all"

  return (
    <Page
      title="Audit log"
      description="Every order add, change and delete, from the web or the green screen."
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
        <SearchInput
          label="Filter by order number"
          placeholder="Order number"
          value={values.ordNo}
          onChange={(v) => set({ ordNo: v.replace(/\D/g, "") || null })}
          className="lg:w-44"
        />
        <SegmentedFilter
          label="Filter by action"
          value={action}
          onChange={(v) => set({ action: v === "all" ? null : v })}
          options={[
            { value: "all", label: "All" },
            { value: "A", label: "Added" },
            { value: "U", label: "Changed" },
            { value: "D", label: "Deleted" },
          ]}
        />
        <SegmentedFilter
          label="Filter by source"
          value={source}
          onChange={(v) => set({ source: v === "all" ? null : v })}
          options={[
            { value: "all", label: "Both" },
            { value: "WEB", label: "WEB" },
            { value: "5250", label: "5250" },
          ]}
        />
        <div className="flex h-9 items-center gap-2 lg:ml-auto">
          <Switch
            id="live"
            checked={live}
            onCheckedChange={(on) => set({ live: on ? "1" : null, page: page })}
          />
          <Label htmlFor="live" className="text-sm font-normal text-muted-foreground">
            Auto-refresh (10 s)
          </Label>
          {live && dataUpdatedAt > 0 && (
            <span
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
              aria-live="polite"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-50 [animation-duration:2s]" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              <span className="num">{timeOf(dataUpdatedAt)}</span>
            </span>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items}
        getRowId={(a) => `${a.ordNo}-${a.action}-${a.at}`}
        isLoading={isPending}
        isFetching={isFetching && !live}
        error={error}
        onRetry={() => void refetch()}
        empty={
          filtered ? (
            <EmptyState
              icon={SearchX}
              title="No audit rows match"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => set({ ordNo: null, action: null, source: null })}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={History}
              title="No audit rows yet"
              description="Rows appear when an order is added, changed or deleted."
            />
          )
        }
        footer={
          data && data.total > 0 ? (
            <Pagination
              page={data.page}
              size={data.size}
              total={data.total}
              noun="rows"
              onPageChange={(p) => set({ page: p })}
            />
          ) : null
        }
      />
    </Page>
  )
}
