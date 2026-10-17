import type { CSSProperties, ReactNode } from "react"
import { AlertTriangle, ArrowRight, ArrowUpRight, History, LineChart } from "lucide-react"
import { Link } from "react-router"

import { useDashboard } from "@/api/hooks/insights"
import type { DashboardData } from "@/api/types"
import { EmptyState } from "@/components/data/EmptyState"
import { ErrorState } from "@/components/data/ErrorState"
import { Money } from "@/components/data/Money"
import { AuditActionBadge, LOW_STOCK, SourceChip } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { Skeleton } from "@/components/ui/skeleton"
import { formatDate, formatDateTime } from "@/lib/dates"
import { formatCount, formatINR } from "@/lib/money"
import { useCountUp } from "@/lib/use-count-up"
import { cn } from "@/lib/utils"

import { Heartbeat } from "./Heartbeat"
import { OrderValueChart } from "./OrderValueChart"

const order = (i: number) => ({ "--i": i }) as CSSProperties

/** A new screen: the green screen has no overview. One API call fills it (handoff §5.4 /dashboard). */
export function DashboardPage() {
  const { data, error, isPending, refetch } = useDashboard()

  return (
    <Page title="Dashboard" description="The order book, stock and IBM i traffic at a glance.">
      {isPending ? (
        <DashboardSkeleton />
      ) : error ? (
        <Panel>
          <ErrorState error={error} onRetry={() => void refetch()} />
        </Panel>
      ) : (
        <DashboardBody data={data} />
      )}
    </Page>
  )
}

function DashboardBody({ data }: { data: DashboardData }) {
  const daysWithOrders = data.valueByDay.filter((d) => d.orders > 0).length

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <OrderBook data={data} />
        <Panel
          style={order(1)}
          title="Order value"
          subtitle={`${daysWithOrders} ${daysWithOrders === 1 ? "day" : "days"} with orders in the last 30 · hover or use arrow keys`}
        >
          {daysWithOrders === 0 ? (
            <EmptyState icon={LineChart} title="No orders in the last 30 days" />
          ) : (
            <OrderValueChart days={data.valueByDay} />
          )}
        </Panel>
      </div>

      <div className="rise" style={order(2)}>
        <Heartbeat />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel
          style={order(3)}
          title="Top items"
          subtitle="By quantity on orders"
          action={{ to: "/items", label: "Items" }}
        >
          <TopItems items={data.topItems} />
        </Panel>
        <Panel
          style={order(4)}
          id="low-stock"
          title="Low stock"
          subtitle={`Active items with ${LOW_STOCK} or fewer left`}
          action={{ to: "/items", label: "Items" }}
        >
          <LowStock items={data.lowStock} />
        </Panel>
        <Panel style={order(5)} title="Recent orders" action={{ to: "/orders", label: "All orders" }}>
          <RecentOrders orders={data.recentOrders} />
        </Panel>
      </div>

      <Panel
        style={order(6)}
        title="Recent activity"
        subtitle="Latest changes in the audit trail, from either channel"
        action={{ to: "/audit", label: "Audit log" }}
      >
        <Activity entries={data.recentAudit} />
      </Panel>
    </div>
  )
}

/** The hero: total open order value, counted up, with the three supporting figures underneath. */
function OrderBook({ data }: { data: DashboardData }) {
  const { kpis } = data
  const value = useCountUp(Number(kpis.orderValue))
  const orders = useCountUp(kpis.openOrders, 700)
  const customers = useCountUp(kpis.activeCustomers, 700)
  const low = useCountUp(kpis.lowStockItems, 700)
  const avg = kpis.openOrders ? Number(kpis.orderValue) / kpis.openOrders : 0

  return (
    <section
      aria-label="Order book"
      className="relative flex rise flex-col overflow-hidden rounded-lg border bg-card"
      style={order(0)}
    >
      <div className="relative flex-1 p-6">
        <p className="num text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Open order book
        </p>
        <Link
          to="/orders?sort=-total"
          className="group mt-3 block w-fit rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <span className="sr-only">
            Total order value {formatINR(kpis.orderValue)}. Show orders by value.
          </span>
          <span
            aria-hidden
            className="block text-[clamp(2.4rem,4.4vw,3.4rem)] leading-none font-semibold display"
          >
            {formatINR(value.toFixed(2))}
          </span>
        </Link>
        <p className="mt-3 text-sm text-muted-foreground">
          across{" "}
          <span className="font-medium text-foreground tabular-nums">{formatCount(kpis.openOrders)}</span>{" "}
          open {kpis.openOrders === 1 ? "order" : "orders"} · average{" "}
          <span className="font-medium text-foreground">{formatINR(avg.toFixed(2))}</span>
        </p>
        <BookShare orders={data.recentOrders} total={kpis.orderValue} count={kpis.openOrders} />
      </div>

      <div className="relative grid grid-cols-3 border-t">
        <Figure label="Open orders" value={formatCount(Math.round(orders))} to="/orders" />
        <Figure
          label="Active customers"
          value={formatCount(Math.round(customers))}
          to="/customers?status=A"
        />
        <Figure
          label="Low on stock"
          value={formatCount(Math.round(low))}
          to="#low-stock"
          warn={kpis.lowStockItems > 0}
        />
      </div>
    </section>
  )
}

const SHADES = ["bg-primary", "bg-primary/70", "bg-primary/50", "bg-primary/35", "bg-primary/20"]

/**
 * Where the book sits: each recent order's share of the total value. The dashboard sends the 5
 * newest orders, so any older ones are grouped as "other".
 */
function BookShare({
  orders,
  total,
  count,
}: {
  orders: DashboardData["recentOrders"]
  total: string
  count: number
}) {
  const all = Number(total)
  if (!orders.length || all <= 0) return null
  const parts = [...orders].sort((a, b) => Number(b.total) - Number(a.total))
  const other = all - parts.reduce((sum, o) => sum + Number(o.total), 0)
  const pct = (v: number) => Math.round((v / all) * 1000) / 10

  return (
    <div className="mt-6">
      <p className="num text-[10.5px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
        Where the book sits
      </p>
      <div aria-hidden className="mt-2 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {parts.map((o, i) => (
          <span
            key={o.ordNo}
            className={cn("h-full origin-left transition-[width] duration-700", SHADES[i] ?? SHADES[4])}
            style={{ width: `${pct(Number(o.total))}%` }}
          />
        ))}
        {other > 0.005 && (
          <span className="h-full bg-muted-foreground/25" style={{ width: `${pct(other)}%` }} />
        )}
      </div>
      <ul className="mt-3 space-y-1.5">
        {parts.map((o, i) => (
          <li key={o.ordNo}>
            <Link
              to={`/orders/${o.ordNo}`}
              className="group flex items-center gap-2.5 rounded text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <span aria-hidden className={cn("size-2 shrink-0 rounded-[2px]", SHADES[i] ?? SHADES[4])} />
              <span className="num text-[12px] text-primary">{o.ordNo}</span>
              <span className="min-w-0 flex-1 truncate group-hover:underline">{o.customerName}</span>
              <span className="num text-[12px] text-muted-foreground">{pct(Number(o.total))}%</span>
            </Link>
          </li>
        ))}
        {other > 0.005 && (
          <li className="flex items-center gap-2.5 text-sm text-muted-foreground">
            <span aria-hidden className="size-2 rounded-[2px] bg-muted-foreground/25" />
            <span className="flex-1">{count - parts.length} older orders</span>
            <span className="num text-[12px]">{pct(other)}%</span>
          </li>
        )}
      </ul>
    </div>
  )
}

function Figure({ label, value, to, warn }: { label: string; value: string; to: string; warn?: boolean }) {
  const cls =
    "group block h-full px-5 py-4 transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
  const body = (
    <>
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {warn && <AlertTriangle aria-hidden className="size-3 text-warning" />}
        {label}
      </span>
      <span
        className={cn(
          "mt-1 flex items-baseline gap-1 text-2xl font-semibold display",
          warn && "text-warning",
        )}
      >
        {value}
        <ArrowUpRight
          aria-hidden
          className="size-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </span>
    </>
  )
  return (
    <div className="border-l first:border-l-0">
      {to.startsWith("#") ? (
        <a href={to} className={cls}>
          {body}
        </a>
      ) : (
        <Link to={to} className={cls}>
          {body}
        </Link>
      )}
    </div>
  )
}

function Panel({
  id,
  title,
  subtitle,
  action,
  className,
  style,
  children,
}: {
  id?: string
  title?: string
  subtitle?: string
  action?: { to: string; label: string }
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  return (
    <section
      id={id}
      style={style}
      className={cn("rise scroll-mt-20 rounded-lg border bg-card p-5", className)}
    >
      {title && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          {action && (
            <Link
              to={action.to}
              className="group inline-flex shrink-0 items-center gap-1 rounded text-xs font-medium text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {action.label}
              <ArrowRight aria-hidden className="size-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

/** Horizontal bars in one hue, value labelled at the end; plain HTML so it reads well and needs no tooltip. */
function TopItems({ items }: { items: DashboardData["topItems"] }) {
  if (items.length === 0) return <Quiet>No order lines yet.</Quiet>
  const max = Math.max(...items.map((i) => i.qty))
  return (
    <ol className="space-y-3.5">
      {items.map((i, rank) => (
        <li key={i.itemNo}>
          <Link
            to={`/items/${i.itemNo}`}
            className="group block rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate group-hover:text-primary">
                <span className="mr-2 num text-[11px] text-muted-foreground">
                  {String(rank + 1).padStart(2, "0")}
                </span>
                {i.description}
              </span>
              <span className="shrink-0 num text-[13px] font-medium">{formatCount(i.qty)}</span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full origin-left rounded-full bg-primary transition-[width] duration-700"
                style={{ width: `${Math.max(4, (i.qty / max) * 100)}%` }}
              />
            </div>
          </Link>
        </li>
      ))}
    </ol>
  )
}

/** Each item with a gauge of what's left against the low-stock line. */
function LowStock({ items }: { items: DashboardData["lowStock"] }) {
  if (items.length === 0) return <Quiet>Every active item has more than {LOW_STOCK} in stock.</Quiet>
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.itemNo}>
          <Link
            to={`/items/${i.itemNo}`}
            className="group block rounded focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <div className="flex items-baseline gap-2 text-sm">
              <span className="num text-[11px] text-muted-foreground">{i.itemNo}</span>
              <span className="min-w-0 flex-1 truncate group-hover:text-primary">{i.description}</span>
              <span
                className={cn(
                  "num text-[13px] font-semibold",
                  i.stockQty === 0 ? "text-danger" : "text-warning",
                )}
              >
                {i.stockQty === 0 ? "out" : `${formatCount(i.stockQty)} left`}
              </span>
            </div>
            <div aria-hidden className="mt-1.5 flex gap-0.5">
              {Array.from({ length: LOW_STOCK }, (_, n) => (
                <span
                  key={n}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    n < i.stockQty ? (i.stockQty <= 2 ? "bg-danger" : "bg-warning") : "bg-muted",
                  )}
                />
              ))}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function RecentOrders({ orders }: { orders: DashboardData["recentOrders"] }) {
  if (orders.length === 0) return <Quiet>No orders yet.</Quiet>
  return (
    <ul className="-mx-2 divide-y divide-dashed">
      {orders.map((o) => (
        <li key={o.ordNo}>
          <Link
            to={`/orders/${o.ordNo}`}
            className="flex items-center gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <span className="num text-[13px] font-medium text-primary">{o.ordNo}</span>
            <span className="min-w-0 flex-1 truncate">
              {o.customerName}
              <span className="block num text-[11px] text-muted-foreground">{formatDate(o.orderDate)}</span>
            </span>
            <Money value={o.total} className="text-[13px]" />
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The audit trail as a horizontal timeline of cards (newest first), scrolling sideways on small screens. */
function Activity({ entries }: { entries: DashboardData["recentAudit"] }) {
  if (entries.length === 0) return <EmptyState icon={History} title="No activity yet" />
  return (
    <ol className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
      {entries.map((a, i) => (
        <li
          key={`${a.ordNo}-${a.at}-${i}`}
          className="min-w-44 snap-start rounded-md border border-dashed bg-background/60 px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <AuditActionBadge action={a.action} />
            <SourceChip source={a.source} />
          </div>
          <p className="mt-2.5 text-sm">
            {a.action === "D" ? (
              <span className="num text-muted-foreground">Order {a.ordNo}</span>
            ) : (
              <Link to={`/orders/${a.ordNo}`} className="num font-medium text-primary hover:underline">
                Order {a.ordNo}
              </Link>
            )}
          </p>
          <p className="mt-0.5 num text-[11px] text-muted-foreground">
            {formatDateTime(a.at)}
            <br />
            {a.user}
          </p>
        </li>
      ))}
    </ol>
  )
}

function Quiet({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Skeleton className="h-80 rounded-lg" />
        <Skeleton className="h-80 rounded-lg" />
      </div>
      <Skeleton className="h-44 rounded-lg" />
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 rounded-lg" />
        ))}
      </div>
    </div>
  )
}
