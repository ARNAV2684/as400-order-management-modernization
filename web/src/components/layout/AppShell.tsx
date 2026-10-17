import { Outlet, useLocation, useNavigate } from "react-router"

import { NAV } from "@/app/nav"
import { useHotkey } from "@/lib/hotkeys"

import { BackendBanner } from "./BackendBanner"
import { GlobalOverlays } from "./GlobalOverlays"
import { SidebarNav } from "./SidebarNav"
import { Topbar } from "./Topbar"

export function AppShell() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  // Alt+1…6 = the menu options, like typing an option number on MENUPGM.
  useHotkey("alt+1", () => navigate(NAV[0].to))
  useHotkey("alt+2", () => navigate(NAV[1].to))
  useHotkey("alt+3", () => navigate(NAV[2].to))
  useHotkey("alt+4", () => navigate(NAV[3].to))
  useHotkey("alt+5", () => navigate(NAV[4].to))
  useHotkey("alt+6", () => navigate(NAV[5].to))

  return (
    <div className="min-h-svh lg:grid lg:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-svh border-r border-sidebar-border lg:block">
        <SidebarNav />
      </aside>
      <div className="flex min-w-0 flex-col">
        <Topbar />
        <BackendBanner />
        {/* key on the path replays the entrance on each page change */}
        <main key={pathname} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-8 lg:py-9">
          <Outlet />
        </main>
      </div>
      <GlobalOverlays />
    </div>
  )
}
