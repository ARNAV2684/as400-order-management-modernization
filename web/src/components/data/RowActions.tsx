import { Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface RowActionsProps {
  label: string
  onView: () => void
  /** Omit to hide Edit. */
  onEdit?: () => void
  onDelete: () => void
  /** Saves are off while IBM i is unreachable. */
  writesDisabled?: boolean
}

/** The ⋯ menu at the end of a row: the web version of X + Enter / F6 / F7 on the 5250 list (display / edit / delete). */
export function RowActions({ label, onView, onEdit, onDelete, writesDisabled }: RowActionsProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Actions for ${label}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem onSelect={onView}>
          <Eye />
          View
        </DropdownMenuItem>
        {onEdit && (
          <DropdownMenuItem onSelect={onEdit} disabled={writesDisabled}>
            <Pencil />
            Edit
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onDelete} disabled={writesDisabled}>
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
