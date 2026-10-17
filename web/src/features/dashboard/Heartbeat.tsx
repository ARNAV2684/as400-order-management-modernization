import { useSyncExternalStore } from "react"
import { Activity } from "lucide-react"

import { traceStore } from "@/api/trace-store"
import type { TraceRecord } from "@/api/types"
import { describeCall } from "@/features/inspector/describe-call"
import { panels } from "@/lib/ui-state"
import { cn } from "@/lib/utils"

const SLOTS = 40

type Kind = "proc" | "sql" | "fail" | "idle"

function kindOf(r: TraceRecord): Kind {
  if (r.error || r.status === 0 || r.status >= 400) return "fail"
  if (r.steps.some((s) => s.kind === "PROC")) return "proc"
  return r.steps.length ? "sql" : "idle"
}

const TONE: Record<Kind, string> = {
  proc: "bg-phosphor shadow-[0_0_8px] shadow-phosphor/60",
  sql: "bg-sidebar-primary/80",
  fail: "bg-red-400",
  idle: "bg-ink-muted/50",
}

/**
 * Live strip of this tab's IBM i traffic: one tick per API call, newest on the right.
 * Height = time taken (log scale, 50 ms … 20 s); colour = what ran on IBM i.
 * A tick opens "Under the hood" with that call's steps.
 */
export function Heartbeat() {
  const records = useSyncExternalStore(traceStore.subscribe, traceStore.getSnapshot)
  const calls = records.slice(0, SLOTS).reverse() // oldest → newest
  const timed = records.filter((r) => r.status > 0)
  const median = timed.length
    ? [...timed].map((r) => r.ms).sort((a, b) => a - b)[Math.floor(timed.length / 2)]
    : null
  const rpg = records.filter((r) => kindOf(r) === "proc").length

  return (
    <section
      aria-label="IBM i heartbeat"
      className="relative overflow-hidden rounded-lg border border-ink-line bg-ink text-ink-foreground dark:border-phosphor/20 dark:shadow-[0_0_40px_-20px] dark:shadow-phosphor/40"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-ink-line px-5 py-3">
        <div className="flex items-center gap-2.5">
          <Activity aria-hidden className="size-4 text-phosphor" />
          <h2 className="text-sm font-semibold">IBM i heartbeat</h2>
          <span className="hidden num text-[11px] text-ink-muted sm:inline">
            every call this tab made, live
          </span>
        </div>
        <dl className="flex items-center gap-5 num text-[11px]">
          <Stat label="calls" value={String(records.length)} />
          <Stat label="RPG calls" value={String(rpg)} />
          <Stat label="median" value={median === null ? "–" : `${median} ms`} />
        </dl>
      </div>

      <ul className="flex h-24 items-end gap-[3px] px-5 pt-4 pb-3" aria-label="Recent calls, oldest first">
        {Array.from({ length: SLOTS - calls.length }, (_, i) => (
          <li key={`e${i}`} aria-hidden className="h-1 flex-1 rounded-sm bg-ink-line" />
        ))}
        {calls.map((r, i) => {
          const kind = kindOf(r)
          const h = Math.min(100, Math.max(8, (Math.log10(Math.max(r.ms, 50)) - 1.7) * 38))
          const label = `${describeCall(r.method, r.path)} · ${r.status === 0 ? "no reply" : r.status} · ${r.ms} ms`
          const newest = i === calls.length - 1
          return (
            <li key={`${r.at}-${r.traceId}`} className="flex flex-1 items-end self-stretch">
              <button
                type="button"
                title={label}
                aria-label={label}
                onClick={() => panels.set("inspector", true)}
                style={{ height: `${h}%` }}
                className={cn(
                  "w-full origin-bottom rounded-sm transition-[height,opacity] duration-500 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none",
                  TONE[kind],
                  newest ? "animate-[blip_.9s_ease-out_1]" : "opacity-75",
                )}
              />
            </li>
          )
        })}
      </ul>

      <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-ink-line px-5 py-2 num text-[10px] text-ink-muted">
        <Legend tone={TONE.proc} label="RPG via stored procedure" />
        <Legend tone={TONE.sql} label="SQL read" />
        <Legend tone={TONE.fail} label="failed" />
        <span className="ml-auto">height = time taken</span>
      </div>
    </section>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-semibold text-ink-foreground tabular-nums">{value}</dd>
    </div>
  )
}

function Legend({ tone, label }: { tone: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className={cn("size-2 rounded-[2px] shadow-none", tone)} />
      {label}
    </span>
  )
}
