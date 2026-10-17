import { NavLink } from "react-router"

import { useBackendStatus, useHealth } from "@/api/hooks/system"
import { NAV } from "@/app/nav"
import { cn } from "@/lib/utils"

/**
 * Brand + navigation, on the dark "ink" panel. Options are numbered like MENUPGM's menu
 * (1. Customers, 2. Items…); Alt+number jumps there (AppShell). Used by the desktop sidebar
 * and the mobile sheet.
 */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
        <BrandMark />
        <div className="leading-none">
          <div className="text-[15px] font-semibold tracking-wide text-ink-foreground [font-stretch:80%]">
            COM
          </div>
          <div className="mt-1 num text-[10px] tracking-wider text-ink-muted uppercase">order mgmt</div>
        </div>
      </div>

      <p className="px-5 pt-5 pb-2 num text-[10px] tracking-[0.18em] text-ink-muted uppercase">Main menu</p>
      <nav aria-label="Main" className="flex flex-1 flex-col gap-px px-3">
        {NAV.map(({ to, label, icon: Icon }, i) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            onClick={onNavigate}
            aria-keyshortcuts={`Alt+${i + 1}`}
            className={({ isActive }) =>
              cn(
                "group relative flex h-9 items-center gap-3 rounded-md px-3 text-sm transition-colors duration-150",
                "outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "hover:bg-white/[0.04] hover:text-ink-foreground",
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden
                  className={cn(
                    "absolute inset-y-2 left-0 w-0.5 rounded-full transition-colors",
                    isActive ? "bg-sidebar-primary" : "bg-transparent",
                  )}
                />
                <span
                  aria-hidden
                  className={cn("w-4 num text-[11px]", isActive ? "text-sidebar-primary" : "text-ink-muted")}
                >
                  {i + 1}
                </span>
                <Icon
                  aria-hidden
                  className={cn(
                    "size-4 shrink-0 transition-colors",
                    isActive ? "text-sidebar-primary" : "text-ink-muted group-hover:text-ink-foreground",
                  )}
                />
                <span className="flex-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <SystemPlate />
    </div>
  )
}

/** Three stacked "subfile rows": the COM mark. */
function BrandMark() {
  return (
    <span
      aria-hidden
      className="grid size-8 place-items-center rounded-md bg-sidebar-primary/10 ring-1 ring-sidebar-primary/30"
    >
      <svg viewBox="0 0 16 16" className="size-4 text-sidebar-primary" fill="none">
        <path
          d="M2.5 4h11M2.5 8h11M2.5 12h6.5"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        />
        <rect x="11.2" y="10.6" width="2.3" height="2.8" rx=".4" className="fill-phosphor" />
      </svg>
    </span>
  )
}

/** The machine this app is wired to, with a live status lamp. */
function SystemPlate() {
  const { data } = useHealth()
  const status = useBackendStatus()
  const live = status === "ok"
  return (
    <div className="m-3 rounded-md border border-sidebar-border bg-white/[0.02] px-3.5 py-3">
      <div className="flex items-center justify-between">
        <span className="num text-[10px] tracking-[0.18em] text-ink-muted uppercase">IBM i</span>
        <span className="flex items-center gap-1.5 num text-[10px] text-ink-muted">
          <span
            aria-hidden
            className={cn(
              "size-1.5 rounded-full",
              live
                ? "bg-phosphor shadow-[0_0_6px] shadow-phosphor"
                : status === "checking"
                  ? "bg-ink-muted"
                  : "bg-red-400",
            )}
          />
          {live ? "online" : status === "checking" ? "checking" : "offline"}
        </span>
      </div>
      <div className="mt-1.5 text-sm font-medium text-ink-foreground">{data?.system ?? "PUB400"} · V7R5</div>
      <div className="num text-[11px] text-ink-muted">{data?.library ?? "ARNAV27122"}</div>
    </div>
  )
}
