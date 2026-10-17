import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { formatCount } from "@/lib/money"

interface PaginationProps {
  page: number
  size: number
  total: number
  onPageChange: (page: number) => void
  /** e.g. "customers" → "1–20 of 45 customers" */
  noun?: string
}

export function Pagination({ page, size, total, onPageChange, noun }: PaginationProps) {
  const lastPage = Math.max(1, Math.ceil(total / size))
  const from = total === 0 ? 0 : (page - 1) * size + 1
  const to = Math.min(total, page * size)

  return (
    <div className="flex items-center justify-between gap-4 border-t px-4 py-2.5 text-xs text-muted-foreground">
      <p className="tabular-nums" aria-live="polite">
        {formatCount(from)}–{formatCount(to)} of {formatCount(total)}
        {noun ? ` ${noun}` : ""}
      </p>
      <div className="flex items-center gap-1">
        <span className="mr-2 tabular-nums">
          Page {page} of {lastPage}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
