import { useId, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import type { DashboardData } from "@/api/types"
import { SegmentedFilter } from "@/components/data/SegmentedFilter"
import { formatDate } from "@/lib/dates"
import { formatINR } from "@/lib/money"

type Day = DashboardData["valueByDay"][number]
type Mode = "daily" | "total"
type Range = "7" | "14" | "30"

interface Point extends Day {
  plot: number
  cum: number
  /** Running total as a decimal string, summed in paise so it never drifts. */
  cumText: string
}

const compactInr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 1,
})
const shortDate = (iso: string) => {
  const [, m, d] = iso.split("-")
  return `${d}/${m}`
}
const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

/**
 * Order value over the last 7 / 14 / 30 days, as the day's value or as a running total.
 * Straight segments, never a smoothed curve: the API sends every day (zero days included), so a
 * straight line between two days is true, while a spline would invent values between them.
 * Dots mark the days that had orders. Hover, or focus the chart and use the arrow keys, for each
 * day. Numbers are only *plotted* as floats; every value shown as text comes from decimal strings.
 */
export function OrderValueChart({ days }: { days: Day[] }) {
  const [mode, setMode] = useState<Mode>("daily")
  const [range, setRange] = useState<Range>("30")
  const gradient = useId()

  const points = useMemo<Point[]>(
    () =>
      days.slice(-Number(range)).reduce<Point[]>((out, d) => {
        const paise = Math.round((out.at(-1)?.cum ?? 0) * 100) + Math.round(Number(d.value) * 100)
        out.push({ ...d, plot: Number(d.value), cum: paise / 100, cumText: (paise / 100).toFixed(2) })
        return out
      }, []),
    [days, range],
  )

  const last = points[points.length - 1]
  const orders = points.reduce((n, p) => n + p.orders, 0)
  const peak = points.reduce<Point | null>((best, p) => (p.plot > (best?.plot ?? 0) ? p : best), null)
  const key = mode === "daily" ? "plot" : "cum"

  return (
    <figure className="m-0">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <dl className="flex gap-6">
          <div>
            <dt className="text-xs text-muted-foreground">In range</dt>
            <dd className="text-xl font-semibold display">{formatINR(last?.cumText)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Orders</dt>
            <dd className="text-xl font-semibold display">{orders}</dd>
          </div>
          {peak && (
            <div className="hidden sm:block">
              <dt className="text-xs text-muted-foreground">Best day</dt>
              <dd className="text-xl font-semibold display">{shortDate(peak.date)}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-wrap gap-2">
          <SegmentedFilter
            label="Chart shows"
            value={mode}
            onChange={setMode}
            options={[
              { value: "daily", label: "Daily" },
              { value: "total", label: "Running total" },
            ]}
          />
          <SegmentedFilter
            label="Range"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7d" },
              { value: "14", label: "14d" },
              { value: "30", label: "30d" },
            ]}
          />
        </div>
      </div>

      <div className="h-60 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={points}
            margin={{ top: 8, right: 18, bottom: 0, left: 0 }}
            // Arrow keys move the tooltip day by day once the chart has focus.
            accessibilityLayer
          >
            <defs>
              <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="date"
              tickFormatter={shortDate}
              padding={{ left: 6, right: 6 }}
              interval={range === "7" ? 0 : range === "14" ? 1 : 6}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
            />
            <YAxis
              width={58}
              tickFormatter={(v: number) => compactInr.format(v)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontFamily: "var(--font-mono)" }}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
              content={(p) => <ChartTooltip active={p.active} payload={p.payload} mode={mode} />}
            />
            <Area
              key={`${mode}-${range}`}
              type="linear"
              dataKey={key}
              stroke="var(--primary)"
              strokeWidth={2}
              fill={`url(#${gradient})`}
              dot={(p: { cx?: number; cy?: number; payload?: Point; index?: number }) =>
                p.payload && p.payload.orders > 0 && p.cx != null && p.cy != null ? (
                  <circle
                    key={p.index}
                    cx={p.cx}
                    cy={p.cy}
                    r={3.5}
                    className="fill-card stroke-primary"
                    strokeWidth={2}
                  />
                ) : (
                  <g key={p.index} />
                )
              }
              activeDot={{ r: 5.5, className: "fill-primary stroke-card", strokeWidth: 2 }}
              isAnimationActive={!reducedMotion()}
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* a table can't shrink to the 1px sr-only box, so the wrapper hides it */}
      <div className="sr-only">
        <table>
          <caption>Order value per day, last {range} days (days with orders)</caption>
          <thead>
            <tr>
              <th>Date</th>
              <th>Orders</th>
              <th>Value</th>
              <th>Running total</th>
            </tr>
          </thead>
          <tbody>
            {points
              .filter((d) => d.orders > 0)
              .map((d) => (
                <tr key={d.date}>
                  <td>{formatDate(d.date)}</td>
                  <td>{d.orders}</td>
                  <td>{formatINR(d.value)}</td>
                  <td>{formatINR(d.cumText)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}

function ChartTooltip({
  active,
  payload,
  mode,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  mode: Mode
}) {
  const day = active ? (payload?.[0]?.payload as Point | undefined) : undefined
  if (!day) return null
  return (
    <div className="min-w-40 rounded-md border bg-popover px-3 py-2.5 text-xs shadow-md">
      <p className="num text-muted-foreground">{formatDate(day.date)}</p>
      <p className="mt-1 num text-sm font-semibold text-foreground">
        {formatINR(mode === "daily" ? day.value : day.cumText)}
      </p>
      <p className="text-muted-foreground">
        {day.orders === 0 ? "No orders" : day.orders === 1 ? "1 order" : `${day.orders} orders`}
        {mode === "daily" ? (
          <>
            {" · "}running <span className="num">{formatINR(day.cumText)}</span>
          </>
        ) : (
          <>
            {" · "}that day <span className="num">{formatINR(day.value)}</span>
          </>
        )}
      </p>
    </div>
  )
}
