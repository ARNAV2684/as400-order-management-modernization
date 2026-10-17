import type { AuditQuery, CustomerQuery, ItemQuery, OrderQuery } from "./types"

/** One key tree per resource, so a save can invalidate exactly what it affected (§6.7). */
export const qk = {
  health: ["health"] as const,
  messages: ["messages"] as const,
  customers: {
    all: ["customers"] as const,
    list: (q: CustomerQuery) => ["customers", "list", q] as const,
    detail: (custNo: number) => ["customers", "detail", custNo] as const,
  },
  items: {
    all: ["items"] as const,
    list: (q: ItemQuery) => ["items", "list", q] as const,
    detail: (itemNo: number) => ["items", "detail", itemNo] as const,
  },
  orders: {
    all: ["orders"] as const,
    list: (q: OrderQuery) => ["orders", "list", q] as const,
    detail: (ordNo: number) => ["orders", "detail", ordNo] as const,
    audit: (ordNo: number) => ["orders", "audit", ordNo] as const,
  },
  dashboard: ["dashboard"] as const,
  audit: ["audit"] as const,
  auditList: (q: AuditQuery) => ["audit", "list", q] as const,
}
