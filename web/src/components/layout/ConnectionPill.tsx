import { useBackendStatus, useHealth } from "@/api/hooks/system"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const TONES = {
  live: "border-success/25 bg-success-soft text-success",
  down: "border-danger/25 bg-danger-soft text-danger",
  checking: "border-border bg-muted text-muted-foreground",
}

/** Polls /api/health every 15 s (§6.4): green when the API and IBM i both answer. */
export function ConnectionPill() {
  const { data } = useHealth()
  const status = useBackendStatus()

  const tone = status === "ok" ? "live" : status === "checking" ? "checking" : "down"

  const label =
    status === "ok"
      ? `${data?.system ?? "IBM i"} · ${data?.latencyMs ?? "–"} ms`
      : status === "checking"
        ? "Connecting…"
        : status === "tunnel-down"
          ? "Tunnel down"
          : "API offline"

  const help =
    status === "ok"
      ? `Connected to ${data?.system ?? "IBM i"} · library ${data?.library ?? "?"} · ${VIA[data?.connection ?? "tunnel"]}`
      : status === "tunnel-down"
        ? data?.connection && data.connection !== "tunnel"
          ? "The API is up but can't reach PUB400 directly. Check the internet connection."
          : "The API is up but can't reach IBM i. Start the tunnel: sh tools/tunnel_pub400.sh"
        : status === "api-down"
          ? "The COM API isn't answering on 127.0.0.1:8000."
          : "Checking the connection…"

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="status"
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap transition-colors duration-300 outline-none focus-visible:ring-2 focus-visible:ring-ring",
            TONES[tone],
          )}
        >
          <SignalBars bars={tone === "live" ? strength(data?.latencyMs) : 0} />
          <span className="num text-[11px] tabular-nums">{label}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-64">
        {help}
      </TooltipContent>
    </Tooltip>
  )
}

const VIA = {
  tunnel: "through the SSH tunnel (encrypted)",
  "direct-tls": "direct, TLS-encrypted",
  "direct-plain": "direct, NOT encrypted",
} as const

/** Tunnel round trip → 1–3 bars (PUB400 is shared, so 1.5 s still counts as healthy). */
function strength(ms: number | null | undefined): number {
  if (ms == null) return 1
  return ms < 1500 ? 3 : ms < 5000 ? 2 : 1
}

function SignalBars({ bars }: { bars: number }) {
  return (
    <span aria-hidden className="flex h-3 items-end gap-[2px]">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          style={{ height: `${n * 33}%` }}
          className={cn(
            "w-[3px] rounded-[1px] transition-colors duration-500",
            n <= bars ? "bg-current" : "bg-current/25",
          )}
        />
      ))}
    </span>
  )
}
