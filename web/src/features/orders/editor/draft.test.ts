import { describe, expect, it } from "vitest"

import type { OrderDetail } from "@/api/types"

import {
  canAddRow,
  draftFromOrder,
  draftReducer,
  emptyDraft,
  isDirty,
  liveRows,
  MAX_LINES,
  toRequest,
  type DraftState,
} from "./draft"

const order: OrderDetail = {
  ordNo: 10002,
  orderDate: "2026-10-01",
  custNo: 2002,
  customerName: "SHARMA TRADERS",
  lineCount: 2,
  status: "O",
  total: "19900.00",
  checksum: "abc",
  lines: [
    { lineNo: 1, itemNo: 5004, description: "24 INCH MONITOR", qty: 2, price: "9500.00", amount: "19000.00" },
    { lineNo: 2, itemNo: 5006, description: "USB PEN DRIVE 64GB", qty: 2, price: "450.00", amount: "900.00" },
  ],
}

const run = (s: DraftState, ...actions: Parameters<typeof draftReducer>[1][]) =>
  actions.reduce(draftReducer, s)

describe("order draft", () => {
  it("starts a new order with today's date and one blank line", () => {
    const s = emptyDraft("2026-10-08")
    expect(s.orderDate).toBe("2026-10-08")
    expect(s.rows).toHaveLength(1)
    expect(s.rows[0]?.action).toBe("N")
  })

  it("skips blank rows in the request, like blank subfile rows (A6)", () => {
    let s = emptyDraft("2026-10-08")
    s = run(s, { type: "customer", custNo: 2001 }, { type: "addRow" })
    s = run(
      s,
      { type: "item", key: s.rows[1]!.key, itemNo: 5001 },
      { type: "qty", key: s.rows[1]!.key, qty: "2" },
    )
    const { draft, keys } = toRequest(s)
    expect(draft.lines).toEqual([{ lineNo: 0, action: "N", itemNo: 5001, qty: 2 }])
    expect(keys).toEqual([s.rows[1]!.key])
  })

  it("removes a new line, but marks an existing one D with undo", () => {
    let s = draftFromOrder(order)
    s = run(s, { type: "addRow" })
    const [first, , added] = s.rows
    s = run(s, { type: "remove", key: added!.key }, { type: "remove", key: first!.key })
    expect(s.rows).toHaveLength(2)
    expect(s.rows[0]?.action).toBe("D")
    expect(toRequest(s).draft.lines[0]).toEqual({ lineNo: 1, action: "D", itemNo: 5004, qty: 2 })
    s = run(s, { type: "undo", key: first!.key })
    expect(s.rows[0]?.action).toBe("C")
  })

  it("keeps the item of an existing line (A4) but lets the qty change", () => {
    let s = draftFromOrder(order)
    const key = s.rows[0]!.key
    s = run(s, { type: "item", key, itemNo: 5001 }, { type: "qty", key, qty: "3" })
    expect(s.rows[0]).toMatchObject({ itemNo: 5004, qty: "3" })
  })

  it("accepts digits only in qty", () => {
    let s = emptyDraft("2026-10-08")
    s = run(s, { type: "qty", key: s.rows[0]!.key, qty: "1a2-3.5" })
    expect(s.rows[0]?.qty).toBe("1235")
  })

  it("stops at 25 live lines (COM0030); deleted lines don't count", () => {
    let s = emptyDraft("2026-10-08")
    for (let i = 0; i < 40; i++) s = run(s, { type: "addRow" })
    expect(liveRows(s)).toHaveLength(MAX_LINES)
    expect(canAddRow(s)).toBe(false)

    let e = draftFromOrder(order)
    e = run(e, { type: "remove", key: e.rows[0]!.key })
    for (let i = 0; i < 40; i++) e = run(e, { type: "addRow" })
    expect(liveRows(e)).toHaveLength(MAX_LINES)
    // undo would make it 26, so it is refused
    expect(run(e, { type: "undo", key: e.rows[0]!.key }).rows[0]?.action).toBe("D")
  })

  it("sends the checksum on edit and knows when something changed", () => {
    const initial = draftFromOrder(order)
    expect(toRequest(initial).draft.checksum).toBe("abc")
    expect(isDirty(initial, initial)).toBe(false)
    expect(isDirty(run(initial, { type: "qty", key: initial.rows[0]!.key, qty: "1" }), initial)).toBe(true)
    // adding an empty row isn't a change worth a "discard?" prompt
    expect(isDirty(run(initial, { type: "addRow" }), initial)).toBe(false)
  })
})
