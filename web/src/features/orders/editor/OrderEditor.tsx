import { useEffect, useMemo, useReducer, useRef, useState } from "react"
import { AlertTriangle, CheckCircle2, Loader2, Lock, RefreshCw } from "lucide-react"
import { useBlocker, useNavigate } from "react-router"
import { toast } from "sonner"

import { ApiError } from "@/api/errors"
import { useCreateOrder, useUpdateOrder } from "@/api/hooks/orders"
import { useBackendStatus, useMessages } from "@/api/hooks/system"
import type { ApiErrorItem } from "@/api/types"
import { CustomerCombobox } from "@/components/data/CustomerCombobox"
import { ErrorBanner } from "@/components/data/ErrorState"
import { Money } from "@/components/data/Money"
import { MessageId } from "@/components/data/StatusBadge"
import { Field } from "@/components/forms/Field"
import { fieldAria } from "@/components/forms/field-aria"
import { saveErrorTitle } from "@/components/forms/save-error"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/dates"
import { useHotkey } from "@/lib/hotkeys"
import { cn } from "@/lib/utils"

import { draftReducer, isDirty, liveRows, toRequest, type DraftState } from "./draft"
import { LinesEditor, type RowInfo } from "./LinesEditor"
import { useLiveValidation } from "./use-live-validation"

interface OrderEditorProps {
  initial: DraftState
  /** Edit only: customer shown read-only (A4). */
  customerName?: string
  /** Edit only: fetch the order again after a COM0039 conflict. */
  onReload?: () => void
}

/** ORDPGM's Add / Edit screen for the web. Every rule is ORDSVC's; this screen only shows its answers. */
export function OrderEditor({ initial, customerName, onReload }: OrderEditorProps) {
  const navigate = useNavigate()
  const isEdit = initial.ordNo > 0
  const [state, dispatch] = useReducer(draftReducer, initial)
  const backendOk = useBackendStatus() === "ok"
  const messages = useMessages().data
  const maxLinesText = messages?.find((m) => m.id === "COM0030")?.text ?? "Maximum 25 lines per order."

  const { draft, keys } = useMemo(() => toRequest(state), [state])
  const draftKey = JSON.stringify(draft)
  const dirty = isDirty(state, initial)
  const hasLines = draft.lines.some((l) => l.action !== "D")
  const {
    result,
    current,
    checking,
    error: checkError,
  } = useLiveValidation(draft, backendOk && (isEdit || draft.custNo > 0 || draft.lines.length > 0))

  const create = useCreateOrder()
  const update = useUpdateOrder()
  const saving = create.isPending || update.isPending
  // A failed save belongs to the draft it was made for; any edit afterwards hides it again.
  const [saveFailure, setSaveFailure] = useState<{ error: ApiError; key: string } | null>(null)
  const failure = saveFailure?.key === draftKey ? saveFailure.error : null
  const [conflict, setConflict] = useState(false)

  // --- which errors to show, and where -------------------------------------------------
  const errors: ApiErrorItem[] = failure?.status === 422 ? failure.errors : (result?.errors ?? [])
  const custTouched = isEdit || state.custNo !== null
  const visible = errors.filter((e) => {
    if (e.line !== null) return true
    if (e.field === "custNo") return custTouched
    if (e.field === "lines") return dirty || isEdit
    return true
  })
  const headerError = (field: string) => visible.find((e) => e.line === null && e.field === field)?.text

  // Per row: what the RPG filled in, plus its messages (errors point at request indexes; keys map them to rows).
  const info = (() => {
    const m = new Map<string, RowInfo>()
    keys.forEach((key, index) => {
      m.set(key, { line: result?.lines.find((l) => l.index === index), errors: {} })
    })
    for (const e of visible) {
      if (e.line === null) continue
      const ri = m.get(keys[e.line] ?? "")
      const f = (e.field === "qty" || e.field === "itemNo" ? e.field : "action") as keyof RowInfo["errors"]
      if (ri && !ri.errors[f]) ri.errors[f] = e.text
    }
    return m
  })()

  const canSave = backendOk && current && Boolean(result?.valid) && !saving && (dirty || !isEdit)

  // --- leaving with unsaved changes (§6.5) --------------------------------------------
  const leaving = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty && !leaving.current && currentLocation.pathname !== nextLocation.pathname,
  )
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [dirty])

  const leaveTo = (path: string, replace = false) => {
    leaving.current = true
    navigate(path, { replace })
  }

  // --- save ------------------------------------------------------------------------------
  const save = async () => {
    if (!canSave) return
    setSaveFailure(null)
    try {
      if (isEdit) {
        const res = await update.mutateAsync(draft)
        toast.success(res.message)
        leaveTo(`/orders/${draft.ordNo}`, true)
      } else {
        const res = await create.mutateAsync(draft)
        toast.success(res.message)
        leaveTo(`/orders/${res.ordNo}`, true)
      }
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      if (e.has("COM0039")) setConflict(true)
      else if (e.has("COM0038"))
        toast.error("This order is being edited elsewhere. Try again in a moment.", {
          description: e.message,
        })
      else setSaveFailure({ error: e, key: draftKey })
    }
  }

  useHotkey("alt+s", () => void save()) // F10; save() itself refuses unless the latest check passed

  const cancelTo = isEdit ? `/orders/${initial.ordNo}` : "/orders"

  return (
    <div className="flex flex-col gap-4 pb-24">
      {failure && failure.status !== 422 && <ErrorBanner error={failure} title={saveErrorTitle(failure)} />}
      <ErrorSummary errors={visible} keys={keys} state={state} />

      {/* ---------------- header ---------------- */}
      <section className="grid gap-5 rounded-lg border bg-card p-5 sm:grid-cols-[10rem_12rem_minmax(0,1fr)] sm:p-6">
        <Field id="ordNo" label="Order number">
          <div className="flex h-9 items-center gap-2 text-sm">
            {isEdit ? (
              <>
                <Lock className="size-3.5 text-muted-foreground" />
                <span className="num font-medium">{initial.ordNo}</span>
              </>
            ) : (
              <span className="text-muted-foreground italic">Assigned on save</span>
            )}
          </div>
        </Field>

        <Field id="orderDate" label="Order date" error={headerError("orderDate")}>
          {isEdit ? (
            <div className="flex h-9 items-center gap-2 num text-sm">
              <Lock className="size-3.5 text-muted-foreground" />
              {formatDate(state.orderDate)}
            </div>
          ) : (
            <Input
              {...fieldAria("orderDate", headerError("orderDate"))}
              type="date"
              value={state.orderDate}
              onChange={(e) => dispatch({ type: "date", value: e.target.value })}
              className="h-9 bg-card num"
            />
          )}
        </Field>

        <Field
          id="custNo"
          label="Customer"
          error={headerError("custNo")}
          hint={!isEdit ? "Inactive customers are listed but can't take orders." : undefined}
        >
          {isEdit ? (
            <div className="flex h-9 min-w-0 items-center gap-2 text-sm">
              <Lock className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="num text-muted-foreground">{state.custNo}</span>
              <span className="truncate font-medium">{customerName}</span>
            </div>
          ) : (
            <CustomerCombobox
              id="custNo"
              value={state.custNo}
              onChange={(custNo) => dispatch({ type: "customer", custNo })}
              placeholder="Pick a customer"
              disableInactive
              invalid={Boolean(headerError("custNo"))}
            />
          )}
        </Field>
      </section>

      {/* ---------------- lines ---------------- */}
      <section className="overflow-hidden rounded-lg border bg-card">
        <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
          <h2 className="text-sm font-semibold">Lines</h2>
          {headerError("lines") && (
            <p role="alert" className="flex items-center gap-1.5 text-xs text-danger">
              <AlertTriangle className="size-3.5" /> {headerError("lines")}
            </p>
          )}
        </div>
        <LinesEditor
          state={state}
          dispatch={dispatch}
          info={info}
          stale={!current}
          maxLinesText={maxLinesText}
        />
      </section>

      {/* ---------------- sticky action bar ---------------- */}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-background/85 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Status
            checking={checking}
            current={current}
            valid={Boolean(result?.valid)}
            problems={visible.length}
            needsCustomer={!isEdit && state.custNo === null}
            needsLines={!hasLines}
            unavailable={!backendOk || Boolean(checkError)}
          />
          <div className="ml-auto flex items-center gap-5">
            <div className="text-right">
              <p className="text-[11px] font-medium text-muted-foreground uppercase">Order total</p>
              <Money
                value={result?.total ?? "0.00"}
                className={cn(
                  "text-lg font-semibold transition-opacity",
                  !current && "text-muted-foreground",
                )}
              />
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => navigate(cancelTo)} disabled={saving}>
                Cancel
              </Button>
              <Button onClick={() => void save()} disabled={!canSave} className="min-w-28">
                {saving && <Loader2 className="animate-spin" />}
                {saving ? "Saving…" : isEdit ? "Save changes" : "Create order"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ---------------- dialogs ---------------- */}
      <AlertDialog open={blocker.state === "blocked"}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>Your changes to this order haven't been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => blocker.reset?.()}>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => blocker.proceed?.()}>
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={conflict} onOpenChange={setConflict}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-warning-soft text-warning">
              <RefreshCw />
            </AlertDialogMedia>
            <AlertDialogTitle>This order was changed elsewhere</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  Someone saved order <span className="num text-foreground">{initial.ordNo}</span> after you
                  opened it, so your save was refused and nothing was changed. <MessageId id="COM0039" />
                </p>
                <p>Reload to start from the latest version. Your edits here will be lost.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep looking</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                leaving.current = true
                onReload?.()
              }}
            >
              Reload order
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Status(p: {
  checking: boolean
  current: boolean
  valid: boolean
  problems: number
  needsCustomer: boolean
  needsLines: boolean
  unavailable: boolean
}) {
  const [icon, text, tone] = p.unavailable
    ? [<AlertTriangle key="i" />, "Can't check with ORDSVC right now", "text-danger"]
    : p.checking
      ? [<Loader2 key="i" className="animate-spin" />, "Checking with ORDSVC…", "text-muted-foreground"]
      : p.needsCustomer
        ? [null, "Pick a customer to start", "text-muted-foreground"]
        : p.needsLines
          ? [null, "Add at least one line", "text-muted-foreground"]
          : p.problems > 0
            ? [
                <AlertTriangle key="i" />,
                `${p.problems} ${p.problems === 1 ? "problem" : "problems"} to fix`,
                "text-danger",
              ]
            : p.current && p.valid
              ? [<CheckCircle2 key="i" />, "Checked by ORDSVC · ready to save", "text-success"]
              : [null, "", "text-muted-foreground"]
  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("flex items-center gap-2 text-sm [&_svg]:size-4", tone)}
    >
      {icon}
      {text}
    </p>
  )
}

/** All visible problems in one list (the green screen shows one message at a time on line 24; the web shows them all). */
function ErrorSummary({
  errors,
  keys,
  state,
}: {
  errors: ApiErrorItem[]
  keys: string[]
  state: DraftState
}) {
  if (errors.length === 0) return null
  const where = (e: ApiErrorItem) => {
    if (e.line === null)
      return e.field === "custNo" ? "Customer" : e.field === "orderDate" ? "Order date" : "Order"
    const row = state.rows.find((r) => r.key === keys[e.line ?? -1])
    if (!row) return "Line"
    return row.lineNo > 0 ? `Line ${row.lineNo}` : `New line ${liveRows(state).indexOf(row) + 1}`
  }
  return (
    <div
      role="alert"
      className="animate-in rounded-xl border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger duration-200 fade-in"
    >
      <p className="font-semibold">
        {errors.length === 1 ? "1 problem" : `${errors.length} problems`} found by ORDSVC
      </p>
      <ul className="mt-1.5 space-y-1">
        {errors.map((e, i) => (
          <li key={`${e.id}-${e.line}-${i}`} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-medium">{where(e)}:</span>
            {e.text}
            <MessageId id={e.id} className="bg-danger/10 text-danger" />
          </li>
        ))}
      </ul>
    </div>
  )
}
