import { useState, type ReactNode } from "react"
import {
  Boxes,
  Keyboard,
  MoonStar,
  Plus,
  ReceiptText,
  SquareTerminal,
  SunMedium,
  Users,
  type LucideIcon,
} from "lucide-react"
import { useNavigate } from "react-router"

import { useCustomers } from "@/api/hooks/customers"
import { useItems } from "@/api/hooks/items"
import { NAV } from "@/app/nav"
import { useTheme } from "@/components/theme/theme-context"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import { formatCount } from "@/lib/money"
import { panels, usePanel } from "@/lib/ui-state"
import { useDebouncedValue } from "@/lib/use-debounced-value"

import { Pill } from "../data/StatusBadge"

/**
 * Ctrl+K: jump to a page, an order / customer / item by number, or a customer / item by name, or run an
 * action. The web answer to typing an option number on the green-screen menu.
 */
export function CommandPalette() {
  const [open, setOpen] = usePanel("palette")
  const [query, setQuery] = useState("")
  const navigate = useNavigate()
  const { resolved, setTheme } = useTheme()

  const q = useDebouncedValue(query.trim(), 200)
  const searching = open && q.length > 0
  // Only ask IBM i once the palette is open and something was typed.
  const customers = useCustomers({ q, size: 5 }, searching)
  const items = useItems({ q, size: 5 }, searching)
  const digits = /^\d{1,7}$/.test(query.trim()) ? Number(query.trim()) : null

  const close = (next: boolean) => {
    setOpen(next)
    if (!next) setQuery("")
  }
  const go = (fn: () => void) => () => {
    close(false)
    fn()
  }
  const matches = (text: string) => !query.trim() || text.toLowerCase().includes(query.trim().toLowerCase())

  const pages = NAV.filter((n) => matches(n.label))
  const actions: { label: string; icon: LucideIcon; run: () => void; hint?: ReactNode }[] = [
    { label: "New order", icon: Plus, run: () => navigate("/orders/new") },
    { label: "New customer", icon: Plus, run: () => navigate("/customers?new=1") },
    { label: "New item", icon: Plus, run: () => navigate("/items?new=1") },
    {
      label: resolved === "dark" ? "Switch to light theme" : "Switch to dark theme",
      icon: resolved === "dark" ? SunMedium : MoonStar,
      run: () => setTheme(resolved === "dark" ? "light" : "dark"),
    },
    { label: "Open Under the hood", icon: SquareTerminal, run: () => panels.set("inspector", true) },
    { label: "Keyboard shortcuts", icon: Keyboard, run: () => panels.set("shortcuts", true), hint: "?" },
  ].filter((a) => matches(a.label))

  return (
    <CommandDialog
      open={open}
      onOpenChange={close}
      title="Command palette"
      description="Jump to a page, record or action"
    >
      <Command shouldFilter={false} loop>
        <CommandInput
          placeholder="Order, customer or item number, a name, or a page…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[min(60vh,420px)]">
          <CommandEmpty>Nothing matches.</CommandEmpty>

          {digits !== null && (
            <CommandGroup heading="Go to number">
              <CommandItem value={`order-${digits}`} onSelect={go(() => navigate(`/orders/${digits}`))}>
                <ReceiptText />
                Order <span className="num">{digits}</span>
              </CommandItem>
              <CommandItem value={`customer-${digits}`} onSelect={go(() => navigate(`/customers/${digits}`))}>
                <Users />
                Customer <span className="num">{digits}</span>
              </CommandItem>
              <CommandItem value={`item-${digits}`} onSelect={go(() => navigate(`/items/${digits}`))}>
                <Boxes />
                Item <span className="num">{digits}</span>
              </CommandItem>
            </CommandGroup>
          )}

          {searching && (customers.data?.items.length ?? 0) > 0 && (
            <CommandGroup heading="Customers">
              {customers.data!.items.map((c) => (
                <CommandItem
                  key={c.custNo}
                  value={`c-${c.custNo}`}
                  onSelect={go(() => navigate(`/customers/${c.custNo}`))}
                >
                  <Users />
                  <span className="w-10 num text-xs text-muted-foreground">{c.custNo}</span>
                  <span className="truncate">{c.name}</span>
                  {c.status === "I" && (
                    <Pill tone="neutral" className="ml-auto">
                      Inactive
                    </Pill>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {searching && (items.data?.items.length ?? 0) > 0 && (
            <CommandGroup heading="Items">
              {items.data!.items.map((i) => (
                <CommandItem
                  key={i.itemNo}
                  value={`i-${i.itemNo}`}
                  onSelect={go(() => navigate(`/items/${i.itemNo}`))}
                >
                  <Boxes />
                  <span className="w-10 num text-xs text-muted-foreground">{i.itemNo}</span>
                  <span className="truncate">{i.description}</span>
                  <span className="ml-auto num text-xs text-muted-foreground">
                    {formatCount(i.stockQty)} in stock
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {pages.length > 0 && (
            <CommandGroup heading="Pages">
              {pages.map(({ to, label, icon: Icon }) => (
                <CommandItem key={to} value={`page-${to}`} onSelect={go(() => navigate(to))}>
                  <Icon />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {actions.length > 0 && (
            <CommandGroup heading="Actions">
              {actions.map(({ label, icon: Icon, run, hint }) => (
                <CommandItem key={label} value={`action-${label}`} onSelect={go(run)}>
                  <Icon />
                  {label}
                  {hint && <CommandShortcut>{hint}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
