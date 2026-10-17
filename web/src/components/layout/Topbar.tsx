import { useState } from "react"
import { Menu, Search, SquareTerminal } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Kbd } from "@/components/ui/kbd"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { panels } from "@/lib/ui-state"

import { ConnectionPill } from "./ConnectionPill"
import { SidebarNav } from "./SidebarNav"
import { ThemeToggle } from "./ThemeToggle"

export function Topbar() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={() => setMenuOpen(true)}
      >
        <Menu className="size-4" />
      </Button>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="w-64 bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Pages of the COM app</SheetDescription>
          <SidebarNav onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      <button
        type="button"
        onClick={() => panels.set("palette", true)}
        className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-md border bg-card px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-primary/30 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:max-w-sm"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 truncate text-left">
          <span className="sm:hidden">Search…</span>
          <span className="hidden sm:inline">Search orders, customers, items…</span>
        </span>
        <Kbd className="hidden sm:inline-flex">Ctrl K</Kbd>
      </button>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        <ConnectionPill />
        <ThemeToggle />
        <Button
          variant="outline"
          size="sm"
          onClick={() => panels.set("inspector", true)}
          className="hidden gap-1.5 sm:inline-flex"
        >
          <SquareTerminal className="size-3.5" />
          Under the hood
        </Button>
      </div>
    </header>
  )
}
