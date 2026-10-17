import type { Dispatch } from "react"
import { AlertCircle, Lock, Plus, Trash2, Undo2 } from "lucide-react"

import type { ValidatedLine } from "@/api/types"
import { ItemCombobox } from "@/components/data/ItemCombobox"
import { Money } from "@/components/data/Money"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { liveRows, MAX_LINES, type DraftAction, type DraftState } from "./draft"

export interface RowInfo {
  /** What the RPG filled in for this row in the last check. */
  line?: ValidatedLine
  errors: Partial<Record<"itemNo" | "qty" | "action", string>>
}

interface LinesEditorProps {
  state: DraftState
  dispatch: Dispatch<DraftAction>
  info: Map<string, RowInfo>
  /** The shown values belong to an older version of the draft; a new check is running. */
  stale: boolean
  maxLinesText: string
}

/** The lines subfile of ORDPGM's Add / Edit screen: 25 rows, Opt D to delete, description / price / amount filled in. */
export function LinesEditor({ state, dispatch, info, stale, maxLinesText }: LinesEditorProps) {
  const live = liveRows(state).length
  const full = live >= MAX_LINES

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="h-10 w-14 pl-5 text-left font-medium">Line</th>
              <th className="h-10 text-left font-medium">Item</th>
              <th className="h-10 w-24 text-right font-medium">Qty</th>
              <th className="h-10 w-32 text-right font-medium">Price</th>
              <th className="h-10 w-36 text-right font-medium">Amount</th>
              <th className="h-10 w-14 pr-3">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {state.rows.map((row, i) => {
              const ri = info.get(row.key)
              const deleted = row.action === "D"
              const existing = row.lineNo > 0
              const hasError = Object.keys(ri?.errors ?? {}).length > 0
              const label = existing ? `line ${row.lineNo}` : `new line ${i + 1}`
              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b align-top transition-colors last:border-0",
                    deleted && "bg-muted/40",
                    hasError && !deleted && "bg-danger-soft/40",
                  )}
                >
                  <td className="py-2.5 pl-5">
                    <span
                      className={cn(
                        "inline-flex h-9 items-center num text-xs",
                        existing ? "text-muted-foreground" : "text-primary",
                      )}
                    >
                      {existing ? row.lineNo : "new"}
                    </span>
                  </td>

                  <td className="py-2.5 pr-3">
                    {existing ? (
                      <div
                        className={cn(
                          "flex h-9 items-center gap-2",
                          deleted && "text-muted-foreground line-through",
                        )}
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Lock
                              tabIndex={0}
                              aria-label="Item locked"
                              className="size-3.5 shrink-0 text-muted-foreground/70"
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            An existing line keeps its item. Change the qty or delete the line.
                          </TooltipContent>
                        </Tooltip>
                        <span className="num text-xs text-muted-foreground">{row.itemNo}</span>
                        <span className="truncate font-medium">{row.original?.description}</span>
                      </div>
                    ) : (
                      <ItemCombobox
                        value={row.itemNo}
                        onChange={(itemNo) => dispatch({ type: "item", key: row.key, itemNo })}
                        invalid={Boolean(ri?.errors.itemNo)}
                        disableInactive
                        aria-label={`Item for ${label}`}
                      />
                    )}
                    <RowMessage text={ri?.errors.itemNo ?? ri?.errors.action} />
                    {deleted && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Will be deleted on save. Stock goes back.
                      </p>
                    )}
                  </td>

                  <td className="py-2.5 pr-3 text-right">
                    <Input
                      aria-label={`Quantity for ${label}`}
                      aria-invalid={ri?.errors.qty ? true : undefined}
                      inputMode="numeric"
                      value={row.qty}
                      disabled={deleted}
                      onChange={(e) => dispatch({ type: "qty", key: row.key, qty: e.target.value })}
                      className={cn("ml-auto h-9 w-20 text-right num", deleted && "line-through")}
                    />
                    {existing && !deleted && row.original && String(row.original.qty) !== row.qty && (
                      <p className="mt-1 text-[11px] text-muted-foreground">was {row.original.qty}</p>
                    )}
                  </td>

                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right",
                      stale && "[&_*]:text-muted-foreground",
                      deleted && "line-through [&_*]:text-muted-foreground",
                    )}
                  >
                    <span className="inline-flex h-9 items-center">
                      {ri?.line?.price ? (
                        <Money value={ri.line.price} className="text-muted-foreground" />
                      ) : (
                        "–"
                      )}
                    </span>
                  </td>
                  <td
                    className={cn(
                      "py-2.5 pr-3 text-right",
                      stale && "[&_*]:text-muted-foreground",
                      deleted && "line-through [&_*]:text-muted-foreground",
                    )}
                  >
                    <span className="inline-flex h-9 items-center">
                      {ri?.line?.amount ? <Money value={ri.line.amount} className="font-medium" /> : "–"}
                    </span>
                    <RowMessage text={ri?.errors.qty} align="right" />
                  </td>

                  <td className="py-2.5 pr-3 text-right">
                    {deleted ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Undo delete of ${label}`}
                              disabled={full}
                              onClick={() => dispatch({ type: "undo", key: row.key })}
                              className="mt-0.5"
                            >
                              <Undo2 className="size-4" />
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{full ? maxLinesText : "Undo delete"}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${label}`}
                        onClick={() => dispatch({ type: "remove", key: row.key })}
                        className="mt-0.5 text-muted-foreground hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t px-5 py-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                disabled={full}
                onClick={() => dispatch({ type: "addRow" })}
              >
                <Plus />
                Add line
              </Button>
            </span>
          </TooltipTrigger>
          {full && <TooltipContent>{maxLinesText}</TooltipContent>}
        </Tooltip>
        <p className="num text-xs text-muted-foreground tabular-nums">
          {live} of {MAX_LINES} lines
        </p>
      </div>
    </div>
  )
}

function RowMessage({ text, align }: { text?: string; align?: "right" }) {
  if (!text) return null
  return (
    <p
      role="alert"
      className={cn(
        "mt-1.5 flex animate-in items-start gap-1 text-xs text-danger duration-200 fade-in",
        align === "right" && "justify-end text-right",
      )}
    >
      <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
      {text}
    </p>
  )
}
