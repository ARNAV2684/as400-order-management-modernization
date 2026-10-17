import type { ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type OnChangeFn,
  type RowData,
  type SortingState,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react"

import type { ApiError } from "@/api/errors"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { cn } from "@/lib/utils"

import { ErrorState } from "./ErrorState"

declare module "@tanstack/react-table" {
  interface ColumnMeta<TData extends RowData, TValue> {
    align?: "left" | "right" | "center"
    /** Tailwind width / visibility classes for both header and cells, e.g. "w-28 hidden md:table-cell". */
    className?: string
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]
  data: T[] | undefined
  getRowId: (row: T) => string
  isLoading: boolean
  /** Background refetch (e.g. paging with keepPreviousData): shows a thin progress bar, keeps rows. */
  isFetching?: boolean
  error?: ApiError | null
  onRetry?: () => void
  empty: ReactNode
  onRowClick?: (row: T) => void
  rowLabel?: (row: T) => string
  /** Server-side sorting: the parent owns the state and passes it to the API. */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
  footer?: ReactNode
  skeletonRows?: number
}

const alignClass = { left: "text-left", right: "text-right", center: "text-center" }

/** Lists everywhere: loading skeletons, empty state, error state with retry (§6.3), keyboard-openable rows. */
export function DataTable<T>({
  columns,
  data,
  getRowId,
  isLoading,
  isFetching,
  error,
  onRetry,
  empty,
  onRowClick,
  rowLabel,
  sorting,
  onSortingChange,
  footer,
  skeletonRows = 8,
}: DataTableProps<T>) {
  // No React Compiler in this app, so its memoisation warning about TanStack Table does not apply.
  // oxlint-disable-next-line react/incompatible-library
  const table = useReactTable({
    data: data ?? [],
    columns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    // A sorted list always has a direction; clicking cycles asc ↔ desc instead of "unsorted".
    enableSortingRemoval: false,
    enableSorting: Boolean(onSortingChange),
    state: sorting ? { sorting } : {},
    onSortingChange,
  })

  const colCount = table.getVisibleLeafColumns().length
  const rows = table.getRowModel().rows

  return (
    <div className="relative overflow-hidden rounded-lg border bg-card">
      {isFetching && !isLoading && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 animate-in overflow-hidden duration-300 fade-in"
        >
          <div className="h-full w-1/3 animate-[progress_1.1s_ease-in-out_infinite] rounded-full bg-primary" />
        </div>
      )}

      <Table>
        <TableHeader className="[&_tr]:border-b-foreground/60">
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id} className="hover:bg-transparent">
              {hg.headers.map((h) => {
                const meta = h.column.columnDef.meta
                const sortable = h.column.getCanSort()
                const dir = h.column.getIsSorted()
                const label = h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())
                return (
                  <TableHead
                    key={h.id}
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                    className={cn(
                      "h-10 num text-[10.5px] font-semibold tracking-[0.08em] text-muted-foreground uppercase",
                      alignClass[meta?.align ?? "left"],
                      meta?.className,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={h.column.getToggleSortingHandler()}
                        className={cn(
                          "-mx-1 inline-flex items-center gap-1 rounded px-1 tracking-[inherit] uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                          meta?.align === "right" && "flex-row-reverse",
                          dir && "text-foreground",
                        )}
                      >
                        {label}
                        {dir === "asc" ? (
                          <ArrowUp className="size-3" />
                        ) : dir === "desc" ? (
                          <ArrowDown className="size-3" />
                        ) : (
                          <ChevronsUpDown className="size-3 opacity-50" />
                        )}
                      </button>
                    ) : (
                      label
                    )}
                  </TableHead>
                )
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }, (_, r) => (
              <TableRow key={`sk-${r}`} className="hover:bg-transparent">
                {table.getVisibleLeafColumns().map((c, i) => (
                  <TableCell key={c.id} className={cn("h-11", c.columnDef.meta?.className)}>
                    <Skeleton
                      className={cn("h-3.5", i === 0 ? "w-14" : r % 3 === 0 ? "w-3/4" : "w-1/2")}
                      style={{ animationDelay: `${r * 60}ms` }}
                    />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : error ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount}>
                <ErrorState error={error} onRetry={onRetry} />
              </TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={colCount}>{empty}</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow
                key={row.id}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? rowLabel(row.original) : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row.original)
                      }
                    : undefined
                }
                className={cn(
                  "transition-colors duration-150 hover:bg-accent/50",
                  onRowClick &&
                    "cursor-pointer focus-visible:bg-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isFetching && "opacity-70",
                )}
              >
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta
                  return (
                    <TableCell
                      key={cell.id}
                      className={cn("h-11", alignClass[meta?.align ?? "left"], meta?.className)}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  )
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      {footer}
    </div>
  )
}
