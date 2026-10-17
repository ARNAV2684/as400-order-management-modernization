import type { ReactNode } from "react"

import type { AuditAction, AuditSource, Status } from "@/api/types"
import { cn } from "@/lib/utils"

type Tone = "success" | "neutral" | "warning" | "danger" | "info"

const TONES: Record<Tone, string> = {
  success: "bg-success-soft text-success",
  neutral: "bg-muted text-muted-foreground",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
}

export function Pill({ tone, children, className }: { tone: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-semibold whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** CSTMST / ITMMST STATUS: A = Active (green), I = Inactive (grey). */
export function StatusBadge({ status }: { status: Status }) {
  return status === "A" ? <Pill tone="success">Active</Pill> : <Pill tone="neutral">Inactive</Pill>
}

/** Low-stock threshold used by the dashboard too (§5.4: low stock ≤ 5). */
export const LOW_STOCK = 5

export function StockBadge({ qty }: { qty: number }) {
  if (qty <= 0) return <Pill tone="danger">Out</Pill>
  if (qty <= LOW_STOCK) return <Pill tone="warning">Low</Pill>
  return <Pill tone="success">OK</Pill>
}

/** A COMxxxx / APIxxxx message ID, shown small and mono beside its text. */
export function MessageId({ id, className }: { id: string; className?: string }) {
  return (
    <span className={cn("rounded bg-muted px-1.5 py-0.5 num text-[10px] text-muted-foreground", className)}>
      {id}
    </span>
  )
}

/** ORDHDR STATUS. Only "O" (Open) exists in v1. */
export function OrderStatusBadge({ status }: { status: "O" }) {
  return status === "O" ? <Pill tone="info">Open</Pill> : <Pill tone="neutral">{status}</Pill>
}

const ACTIONS: Record<AuditAction, { label: string; tone: Tone }> = {
  A: { label: "Created", tone: "success" },
  U: { label: "Changed", tone: "info" },
  D: { label: "Deleted", tone: "danger" },
}

/** ORDAUD ACTION: A green, U blue, D red (handoff §6.5). */
export function AuditActionBadge({ action }: { action: AuditAction }) {
  const a = ACTIONS[action]
  return (
    <Pill tone={a.tone}>
      <span className="num">{action}</span> · {a.label}
    </Pill>
  )
}

/** Which channel made the change: the web app or the 5250 green screen. */
export function SourceChip({ source }: { source: AuditSource }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded border px-1.5 num text-[10px] font-medium",
        source === "WEB"
          ? "border-primary/30 bg-brand-soft text-primary"
          : "border-border bg-muted text-muted-foreground",
      )}
    >
      {source}
    </span>
  )
}
