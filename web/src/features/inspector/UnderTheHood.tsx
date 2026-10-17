import { useState, useSyncExternalStore } from "react"
import { Check, Database, SquareTerminal, Trash2, X } from "lucide-react"

import { traceStore } from "@/api/trace-store"
import type { TraceRecord, TraceStep } from "@/api/types"
import { MessageId } from "@/components/data/StatusBadge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { usePanel } from "@/lib/ui-state"
import { cn } from "@/lib/utils"

import { describeCall } from "./describe-call"

const clock = (ms: number) =>
  new Date(ms).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

/**
 * The demo's "how does this work?" panel (handoff §6.5): every API call this tab made, newest first,
 * with the IBM i steps the API reported in X-COM-Trace — which RPG program or SQL ran, with what action
 * code, how long it took, and whether it succeeded. Object names, actions and timings only; no data.
 */
export function UnderTheHood() {
  const [open, setOpen] = usePanel("inspector")
  const records = useSyncExternalStore(traceStore.subscribe, traceStore.getSnapshot)
  const [showHealth, setShowHealth] = useState(false)
  const shown = showHealth ? records : records.filter((r) => r.path !== "/health")

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-5 pt-5 pb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <SquareTerminal className="size-4 text-primary" />
            Under the hood
          </SheetTitle>
          <SheetDescription>Each call this page made, and what it ran on IBM i.</SheetDescription>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Switch id="show-health" checked={showHealth} onCheckedChange={setShowHealth} />
              <Label htmlFor="show-health" className="text-xs font-normal text-muted-foreground">
                Show connection checks
              </Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => traceStore.clear()}
              disabled={records.length === 0}
            >
              <Trash2 />
              Clear
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {shown.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="grid size-11 place-items-center rounded-full bg-brand-soft text-primary">
                <Database className="size-5" />
              </div>
              <p className="mt-4 text-sm font-medium">No calls yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Open a list or save something, and each IBM i call shows up here.
              </p>
            </div>
          ) : (
            <ol className="space-y-3" aria-live="polite" aria-label="API calls, newest first">
              {shown.map((r, i) => (
                <CallCard key={`${r.at}-${r.traceId}-${i}`} record={r} />
              ))}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CallCard({ record: r }: { record: TraceRecord }) {
  const ok = !r.error && r.status > 0 && r.status < 400
  return (
    <li
      className={cn(
        "animate-in rounded-lg border bg-card px-3.5 py-3 duration-300 fade-in slide-in-from-top-1",
        !ok && "border-danger/30 bg-danger-soft/40",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{describeCall(r.method, r.path)}</p>
          <p className="mt-0.5 truncate num text-[11px] text-muted-foreground">
            {r.method} /api{r.path}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded px-1.5 py-0.5 num text-[11px] font-medium",
              ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
            )}
          >
            {ok ? <Check className="size-3" /> : <X className="size-3" />}
            {r.status === 0 ? "no reply" : r.status}
          </span>
          <span className="num text-[11px] text-muted-foreground">
            {clock(r.at)} · {r.ms} ms
          </span>
        </div>
      </div>

      {r.steps.length > 0 && <Waterfall record={r} />}

      {r.error && (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-danger">
          <MessageId id={r.error.id} className="bg-danger/10 text-danger" />
          {r.error.text}
        </p>
      )}
    </li>
  )
}

/**
 * The request as a waterfall: each IBM i step sits where it ran inside the call (steps run one
 * after another), so the gap that's left is API + tunnel time.
 */
function Waterfall({ record: r }: { record: TraceRecord }) {
  const total = Math.max(
    r.ms,
    r.steps.reduce((sum, s) => sum + s.ms, 0),
    1,
  )
  // Each step starts where the previous ones ended.
  const starts = r.steps.map((_, i) => r.steps.slice(0, i).reduce((sum, s) => sum + s.ms, 0))
  const overhead = Math.max(0, r.ms - r.steps.reduce((sum, s) => sum + s.ms, 0))
  return (
    <ul className="mt-2.5 space-y-2 border-t pt-2.5">
      {r.steps.map((s, i) => {
        const left = (starts[i] / total) * 100
        return <StepLine key={i} step={s} left={left} width={Math.max(1.5, (s.ms / total) * 100)} />
      })}
      {overhead > 0 && (
        <li className="flex items-center gap-2 num text-[10px] text-muted-foreground">
          <span className="w-9 shrink-0 text-center">API</span>
          <span className="flex-1">API + tunnel round trip</span>
          <span>{overhead} ms</span>
        </li>
      )}
    </ul>
  )
}

function StepLine({ step: s, left, width }: { step: TraceStep; left: number; width: number }) {
  return (
    <li className="num text-[11px] leading-relaxed">
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "w-9 shrink-0 rounded px-1 text-center font-semibold",
            s.kind === "PROC" ? "bg-brand-soft text-primary" : "bg-muted text-muted-foreground",
          )}
        >
          {s.kind}
        </span>
        <span className="min-w-0 flex-1 break-words text-foreground/90">
          {s.target}
          {s.action && <span className="text-muted-foreground"> · action {s.action}</span>}
        </span>
        <span className="shrink-0 text-muted-foreground">{s.ms} ms</span>
        <span className={cn("shrink-0", s.ok ? "text-success" : "text-danger")}>
          <span aria-hidden>{s.ok ? "✓" : "✗"}</span>
          <span className="sr-only">{s.ok ? "succeeded" : "failed"}</span>
        </span>
      </div>
      <div aria-hidden className="relative mt-1 ml-11 h-1.5 rounded-full bg-muted">
        <span
          className={cn(
            "absolute inset-y-0 rounded-full",
            !s.ok ? "bg-danger" : s.kind === "PROC" ? "bg-primary" : "bg-muted-foreground/60",
          )}
          style={{ left: `${left}%`, width: `${width}%` }}
        />
      </div>
    </li>
  )
}
