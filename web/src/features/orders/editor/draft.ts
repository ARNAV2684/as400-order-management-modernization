import type { LineAction, OrderDetail, OrderDraft } from "@/api/types"

/*
 * The order being edited, as plain data + a reducer (no React in here, so it's easy to test).
 * Rows are what the user sees; the request is what ORDSVC gets.
 */

export const MAX_LINES = 25 // SFLSIZ 25, COM0030

export interface DraftRow {
  /** Stable React key; never sent. */
  key: string
  /** 0 = new line (the RPG numbers it on save, A6). */
  lineNo: number
  action: LineAction
  itemNo: number | null
  /** Digits only, as typed. */
  qty: string
  /** What the line was when the order was loaded (edit only). */
  original?: { itemNo: number; qty: number; description: string }
}

export interface DraftState {
  /** 0 = new order. */
  ordNo: number
  orderDate: string
  custNo: number | null
  checksum?: string
  rows: DraftRow[]
}

let seq = 0
const newKey = () => `row-${++seq}`

export const blankRow = (): DraftRow => ({ key: newKey(), lineNo: 0, action: "N", itemNo: null, qty: "1" })

export function emptyDraft(today: string): DraftState {
  return { ordNo: 0, orderDate: today, custNo: null, rows: [blankRow()] }
}

export function draftFromOrder(o: OrderDetail): DraftState {
  return {
    ordNo: o.ordNo,
    orderDate: o.orderDate,
    custNo: o.custNo,
    checksum: o.checksum,
    rows: o.lines.map((l) => ({
      key: newKey(),
      lineNo: l.lineNo,
      action: "C",
      itemNo: l.itemNo,
      qty: String(l.qty),
      original: { itemNo: l.itemNo, qty: l.qty, description: l.description },
    })),
  }
}

export type DraftAction =
  | { type: "date"; value: string }
  | { type: "customer"; custNo: number | null }
  | { type: "addRow" }
  | { type: "remove"; key: string }
  | { type: "undo"; key: string }
  | { type: "item"; key: string; itemNo: number | null }
  | { type: "qty"; key: string; qty: string }

/** Lines that will exist after saving (deleted ones don't count towards the 25). */
export const liveRows = (s: DraftState) => s.rows.filter((r) => r.action !== "D")
export const canAddRow = (s: DraftState) => liveRows(s).length < MAX_LINES

function updateRow(s: DraftState, key: string, f: (r: DraftRow) => DraftRow): DraftState {
  return { ...s, rows: s.rows.map((r) => (r.key === key ? f(r) : r)) }
}

export function draftReducer(s: DraftState, a: DraftAction): DraftState {
  switch (a.type) {
    case "date":
      return { ...s, orderDate: a.value }
    case "customer":
      return { ...s, custNo: a.custNo }
    case "addRow":
      return canAddRow(s) ? { ...s, rows: [...s.rows, blankRow()] } : s
    case "remove": {
      const row = s.rows.find((r) => r.key === a.key)
      if (!row) return s
      // A new line simply disappears; an existing one is marked D so it can be undone (and ORDSVC deletes it).
      return row.lineNo === 0
        ? { ...s, rows: s.rows.filter((r) => r.key !== a.key) }
        : updateRow(s, a.key, (r) => ({ ...r, action: "D" }))
    }
    case "undo":
      return canAddRow(s) ? updateRow(s, a.key, (r) => (r.action === "D" ? { ...r, action: "C" } : r)) : s
    case "item":
      // Existing lines keep their item (A4: change the qty, or delete the line).
      return updateRow(s, a.key, (r) => (r.lineNo === 0 ? { ...r, itemNo: a.itemNo } : r))
    case "qty":
      return updateRow(s, a.key, (r) => ({ ...r, qty: a.qty.replace(/\D/g, "").slice(0, 7) }))
  }
}

/**
 * The ORDSVC request. Rows with no item yet are skipped, like blank subfile rows on the green screen (A6).
 * `keys[i]` is the row behind request line i, so errors (which point at a request index) find their row.
 */
export function toRequest(s: DraftState): { draft: OrderDraft; keys: string[] } {
  const rows = s.rows.filter((r) => r.itemNo !== null)
  return {
    keys: rows.map((r) => r.key),
    draft: {
      ordNo: s.ordNo,
      orderDate: s.orderDate,
      custNo: s.custNo ?? 0,
      ...(s.checksum ? { checksum: s.checksum } : {}),
      lines: rows.map((r) => ({
        lineNo: r.lineNo,
        action: r.action,
        itemNo: r.itemNo!,
        qty: Number(r.qty || 0),
      })),
    },
  }
}

/** Something worth asking "discard changes?" about. */
export function isDirty(s: DraftState, initial: DraftState): boolean {
  return JSON.stringify(toRequest(s).draft) !== JSON.stringify(toRequest(initial).draft)
}

/** Local date as YYYY-MM-DD (A8: the order date defaults to today). */
export function todayIso(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
