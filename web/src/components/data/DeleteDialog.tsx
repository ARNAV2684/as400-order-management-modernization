import { useState, type ReactNode } from "react"
import { AlertTriangle, Ban, Loader2, Trash2 } from "lucide-react"

import { useBackendStatus } from "@/api/hooks/system"
import { ApiError } from "@/api/errors"
import type { SaveResult } from "@/api/types"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

import { ErrorBanner } from "./ErrorState"
import { MessageId } from "./StatusBadge"

interface DeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "customer" / "item" */
  noun: string
  /** e.g. "2003 · GUPTA ELECTRONICS" */
  recordLabel: string
  /** Message IDs meaning "in use, can't delete" (COM0009 / COM0017). Orders have none. */
  blockedIds?: string[]
  /** Explains what the block means, like the message's second-level help on the green screen. */
  blockedHelp?: string
  /** Extra facts shown before confirming, e.g. an order's customer, lines and total. */
  details?: ReactNode
  /** Side effect to warn about, e.g. "Stock will be returned." */
  warning?: ReactNode
  onDelete: () => Promise<SaveResult>
  /** Edit with Status I. Omit when the record is already inactive. */
  onSetInactive?: () => Promise<SaveResult>
  onDone: (message: string, deleted: boolean) => void
}

type Phase = { kind: "confirm" } | { kind: "blocked"; error: ApiError } | { kind: "failed"; error: ApiError }

/**
 * Delete with the RPG as the judge: the dialog asks, the service program decides. If it refuses because the
 * record is in use, offer the green screen's advice as one click: set Status to I instead.
 */
export function DeleteDialog(props: DeleteDialogProps) {
  const {
    open,
    onOpenChange,
    noun,
    recordLabel,
    blockedIds = [],
    blockedHelp,
    details,
    warning,
    onDelete,
    onSetInactive,
    onDone,
  } = props
  const [phase, setPhase] = useState<Phase>({ kind: "confirm" })
  const [busy, setBusy] = useState<"delete" | "inactive" | null>(null)
  const backendOk = useBackendStatus() === "ok"

  const reset = (next: boolean) => {
    if (busy) return
    onOpenChange(next)
    if (!next) setTimeout(() => setPhase({ kind: "confirm" }), 200) // after the close animation
  }

  const run = async (which: "delete" | "inactive") => {
    const action = which === "delete" ? onDelete : onSetInactive
    if (!action) return
    setBusy(which)
    try {
      const res = await action()
      setBusy(null)
      onOpenChange(false)
      setTimeout(() => setPhase({ kind: "confirm" }), 200)
      onDone(res.message, which === "delete")
    } catch (e) {
      setBusy(null)
      if (!(e instanceof ApiError)) throw e
      const blocked = which === "delete" && e.errors.some((x) => blockedIds.includes(x.id))
      setPhase(blocked ? { kind: "blocked", error: e } : { kind: "failed", error: e })
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={reset}>
      <AlertDialogContent className="sm:max-w-md">
        {phase.kind === "blocked" ? (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-warning-soft text-warning">
                <Ban />
              </AlertDialogMedia>
              <AlertDialogTitle>Can't delete this {noun}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="flex flex-wrap items-center gap-2 text-foreground">
                    {phase.error.message}
                    {phase.error.id && <MessageId id={phase.error.id} />}
                  </p>
                  {blockedHelp && <p>{blockedHelp}</p>}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy !== null}>Close</AlertDialogCancel>
              {onSetInactive && (
                <Button onClick={() => void run("inactive")} disabled={busy !== null || !backendOk}>
                  {busy === "inactive" && <Loader2 className="animate-spin" />}
                  Set Inactive instead
                </Button>
              )}
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogMedia className="bg-danger-soft text-danger">
                <Trash2 />
              </AlertDialogMedia>
              <AlertDialogTitle>Delete {noun}?</AlertDialogTitle>
              <AlertDialogDescription>
                <span className="num text-foreground">{recordLabel}</span> will be removed. This can't be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {details}
            {warning && (
              <p className="flex items-start gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
                <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span>{warning}</span>
              </p>
            )}
            {phase.kind === "failed" && <ErrorBanner error={phase.error} />}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => void run("delete")}
                disabled={busy !== null || !backendOk}
              >
                {busy === "delete" && <Loader2 className="animate-spin" />}
                Delete
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  )
}
