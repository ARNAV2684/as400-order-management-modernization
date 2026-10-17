import { Boxes, Cpu, History, LayoutDashboard, ReceiptText, Users, type LucideIcon } from "lucide-react"

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Footnote on the page: which green-screen program it replaces, per handoff §6.5. */
  replaces: string
}

export const NAV: readonly NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, replaces: "New screen · no 5250 equivalent" },
  { to: "/orders", label: "Orders", icon: ReceiptText, replaces: "Replaces ORDPGM · Order list" },
  { to: "/customers", label: "Customers", icon: Users, replaces: "Replaces CUSTPGM · Customer list" },
  { to: "/items", label: "Items", icon: Boxes, replaces: "Replaces ITEMPGM · Item list" },
  { to: "/audit", label: "Audit log", icon: History, replaces: "New screen · reads the journal (ORDAUDJV)" },
  { to: "/system", label: "System", icon: Cpu, replaces: "New screen · how the web layer sits on IBM i" },
]
