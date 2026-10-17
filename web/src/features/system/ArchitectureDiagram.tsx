import { useEffect, useId, useRef, useState } from "react"

import { traceStore } from "@/api/trace-store"
import type { TraceRecord } from "@/api/types"

/*
 * Handoff §2 drawn as SVG. Colours come from theme tokens (via Tailwind fill-/stroke- classes), so it works in
 * light and dark. Fixed viewBox; the wrapper scrolls sideways on narrow screens instead of shrinking text.
 */

function Box(p: {
  x: number
  y: number
  w: number
  h: number
  title: string
  sub: string
  tone?: "accent" | "muted"
}) {
  return (
    <g>
      <rect
        x={p.x}
        y={p.y}
        width={p.w}
        height={p.h}
        rx={10}
        className={
          p.tone === "accent"
            ? "fill-brand-soft stroke-primary/50"
            : p.tone === "muted"
              ? "fill-muted stroke-border"
              : "fill-card stroke-border"
        }
        strokeWidth={1.25}
      />
      <text x={p.x + 14} y={p.y + 24} className="fill-foreground text-[13px] font-semibold">
        {p.title}
      </text>
      <text x={p.x + 14} y={p.y + 43} className="fill-muted-foreground font-mono text-[10.5px]">
        {p.sub}
      </text>
    </g>
  )
}

export function ArchitectureDiagram() {
  const arrow = useId()
  const label = "fill-muted-foreground text-[10.5px]"

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 900 330"
        role="img"
        aria-labelledby={`${arrow}-t ${arrow}-d`}
        className="h-auto w-full min-w-[720px]"
      >
        <title id={`${arrow}-t`}>COM architecture</title>
        <desc id={`${arrow}-d`}>
          The browser calls the FastAPI service over REST. The API reaches IBM i with ODBC. Writes go through
          SQL procedures to the RPG service programs, which also serve the 5250 green-screen programs. Reads
          may select directly from the physical and logical files. The audit trail is read from the journal
          (view ORDAUDJV).
        </desc>
        <defs>
          <marker
            id={arrow}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" className="fill-muted-foreground" />
          </marker>
        </defs>

        {/* IBM i boundary */}
        <rect
          x={470}
          y={8}
          width={420}
          height={314}
          rx={14}
          className="fill-transparent stroke-primary/40"
          strokeDasharray="6 5"
          strokeWidth={1.25}
        />
        <text x={488} y={30} className="fill-primary text-[11px] font-semibold tracking-wide uppercase">
          PUB400 · IBM i V7R5 · ARNAV27122
        </text>

        <Box x={16} y={56} w={166} h={58} title="Browser" sub="React + TypeScript" tone="accent" />
        <Box x={228} y={56} w={172} h={58} title="FastAPI" sub="127.0.0.1:8000" />

        <Box x={488} y={56} w={180} h={58} title="SQL procedures" sub="*SVC_API (thin doors)" />
        <Box
          x={488}
          y={150}
          w={180}
          h={58}
          title="RPG service programs"
          sub="CUSTSVC ITEMSVC ORDSVC"
          tone="accent"
        />
        <Box x={488} y={244} w={180} h={58} title="Database (PF / LF)" sub="CSTMST ITMMST ORDHDR…" />
        <Box
          x={696}
          y={56}
          w={178}
          h={58}
          title="5250 green screen"
          sub="CUSTPGM ITEMPGM ORDPGM"
          tone="muted"
        />
        <Box x={696} y={244} w={178} h={58} title="Journal COMJRN" sub="audit view ORDAUDJV" tone="muted" />

        {/* browser → API */}
        <line
          x1={182}
          y1={85}
          x2={224}
          y2={85}
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          markerEnd={`url(#${arrow})`}
        />
        <text x={204} y={76} textAnchor="middle" className={label}>
          REST
        </text>
        {/* API → procedures (writes) */}
        <line
          x1={400}
          y1={85}
          x2={484}
          y2={85}
          className="stroke-primary"
          strokeWidth={2}
          markerEnd={`url(#${arrow})`}
        />
        <text x={435} y={76} textAnchor="middle" className="fill-primary text-[10.5px] font-medium">
          writes
        </text>
        <text x={435} y={104} textAnchor="middle" className={label}>
          ODBC
        </text>
        {/* procedures → RPG → DB */}
        <line
          x1={578}
          y1={114}
          x2={578}
          y2={146}
          className="stroke-primary"
          strokeWidth={2}
          markerEnd={`url(#${arrow})`}
        />
        <line
          x1={578}
          y1={208}
          x2={578}
          y2={240}
          className="stroke-primary"
          strokeWidth={2}
          markerEnd={`url(#${arrow})`}
        />
        {/* 5250 → RPG */}
        <path
          d="M785,114 L785,179 L672,179"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          markerEnd={`url(#${arrow})`}
        />
        <text x={792} y={150} className={label}>
          same rules
        </text>
        {/* DB → trigger */}
        <line
          x1={668}
          y1={273}
          x2={692}
          y2={273}
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          markerEnd={`url(#${arrow})`}
        />
        {/* API ··· DB (reads) */}
        <path
          d="M314,148 L314,273 L484,273"
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          markerEnd={`url(#${arrow})`}
        />
        <text x={324} y={262} className={label}>
          reads: plain SELECT
        </text>

        <LivePacket />
      </svg>
    </div>
  )
}

const PATHS = {
  // browser → API → procedure → RPG → files
  write: "M99,85 L314,85 L578,85 L578,179 L578,273",
  // browser → API → files (plain SELECT)
  read: "M99,85 L314,85 L314,273 L578,273",
}

/**
 * Each real API call that finishes sends one packet along the path it took: through the stored
 * procedure and RPG for writes (a PROC step), straight to the files for reads. Red if it failed.
 * Off with reduced motion.
 */
function LivePacket() {
  const [packet, setPacket] = useState<TraceRecord | null>(null)
  const motion = useRef<SVGAnimateMotionElement>(null)

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    let seen = traceStore.getSnapshot()[0]
    let timer: ReturnType<typeof setTimeout> | undefined
    const unsubscribe = traceStore.subscribe(() => {
      const latest = traceStore.getSnapshot()[0]
      if (!latest || latest === seen) return
      seen = latest
      if (latest.path === "/health") return
      setPacket(latest)
      clearTimeout(timer)
      timer = setTimeout(() => setPacket(null), 1600)
    })
    return () => {
      unsubscribe()
      clearTimeout(timer)
    }
  }, [])

  useEffect(() => {
    // A SMIL animation added after load must be started by hand, or it counts from page load.
    motion.current?.beginElement()
  }, [packet])

  if (!packet) return null
  const write = packet.steps.some((s) => s.kind === "PROC")
  const failed = Boolean(packet.error) || packet.status === 0 || packet.status >= 400
  return (
    <g aria-hidden key={`${packet.at}-${packet.traceId}`}>
      <circle r={5.5} className={failed ? "fill-danger" : write ? "fill-primary" : "fill-muted-foreground"}>
        <animateMotion
          ref={motion}
          begin="indefinite"
          dur="1.4s"
          fill="freeze"
          path={write ? PATHS.write : PATHS.read}
        />
      </circle>
    </g>
  )
}
