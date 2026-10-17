import type { Customer, Item, OrderSummary } from "@/api/types"

import { edit1, editDateY, editJ, editZ, fmtDateEur, type ScreenBuffer } from "./screen-buffer"

/** One green-screen list: its control record (heading), subfile row layout and key legend, from the DDS. */
export interface ListScreen<T> {
  /** Record format names, shown in the caption. */
  formats: string
  /** First subfile row and rows per page (SFLPAG). */
  sflStart: number
  sflPag: number
  header(buf: ScreenBuffer, ctx: ScreenContext): void
  row(buf: ScreenBuffer, line: number, item: T): void
  /** What a screen reader hears for a row. */
  label(item: T): string
}

export interface ScreenContext {
  user: string
  /** Order list only: the SRCHCUST field. */
  custNo?: number | null
}

function stamp(buf: ScreenBuffer, ctx: ScreenContext) {
  buf.put(1, 72, editDateY()).put(2, 71, ctx.user.padEnd(10).slice(0, 10))
}

const keys = (buf: ScreenBuffer, add: string) =>
  buf.put(23, 2, `F3=Exit  ${add}  F6=Edit  F7=Delete  F12=Back`, "blue")

/** ORDDSPF: ORDCTL + ORDSFL + ORDKEY. */
export const ORDER_LIST: ListScreen<OrderSummary> = {
  formats: "ORDDSPF · ORDCTL / ORDSFL",
  sflStart: 7,
  sflPag: 10,
  header(buf, ctx) {
    buf.put(1, 2, "ORDLIST").put(1, 23, "ORDER MAINTENANCE - ORDER LIST", "hi")
    stamp(buf, ctx)
    buf.put(3, 2, "Customer No (blank = all):").put(3, 30, editZ(ctx.custNo ?? 0, 7), "ul")
    buf.put(5, 2, "Type X, then Enter=Display  F6=Edit  F7=Delete", "blue")
    for (const [col, h] of [
      [2, "Sel"],
      [6, "Order No"],
      [15, "Date"],
      [27, "Cust No"],
      [36, "Customer Name"],
      [76, "Total"],
    ] as const)
      buf.put(6, col, h, "ul")
    keys(buf, "F5=Create")
  },
  row(buf, line, o) {
    buf
      .put(line, 3, " ", "ul")
      .put(line, 6, editZ(o.ordNo, 7))
      .put(line, 15, fmtDateEur(o.orderDate))
      .put(line, 27, editZ(o.custNo, 7))
      .put(line, 36, o.customerName.slice(0, 28))
      .put(line, 66, edit1(o.total, 11, 2))
  },
  label: (o) => `Order ${o.ordNo}, ${o.customerName}, total ${o.total}`,
}

/** CUSTDSPF: CUSTCTL + CUSTSFL + CUSTKEY. */
export const CUSTOMER_LIST: ListScreen<Customer> = {
  formats: "CUSTDSPF · CUSTCTL / CUSTSFL",
  sflStart: 6,
  sflPag: 10,
  header(buf, ctx) {
    buf.put(1, 2, "CUSTLIST").put(1, 30, "CUSTOMER MAINTENANCE", "hi")
    stamp(buf, ctx)
    buf.put(4, 2, "Type X, then Enter=Display  F6=Edit  F7=Delete", "blue")
    for (const [col, h] of [
      [2, "Sel"],
      [6, "Cust No"],
      [15, "Customer Name"],
      [57, "City"],
      [77, "Sts"],
    ] as const)
      buf.put(5, col, h, "ul")
    keys(buf, "F5=Add")
  },
  row(buf, line, c) {
    buf
      .put(line, 3, " ", "ul")
      .put(line, 6, editZ(c.custNo, 7))
      .put(line, 15, c.name.slice(0, 40))
      .put(line, 57, c.city.slice(0, 20))
      .put(line, 79, c.status)
  },
  label: (c) => `Customer ${c.custNo}, ${c.name}, ${c.city}, ${c.status === "A" ? "active" : "inactive"}`,
}

/** ITEMDSPF: ITEMCTL + ITEMSFL + ITEMKEY. */
export const ITEM_LIST: ListScreen<Item> = {
  formats: "ITEMDSPF · ITEMCTL / ITEMSFL",
  sflStart: 6,
  sflPag: 10,
  header(buf, ctx) {
    buf.put(1, 2, "ITEMLIST").put(1, 31, "ITEM MAINTENANCE", "hi")
    stamp(buf, ctx)
    buf.put(4, 2, "Type X, then Enter=Display  F6=Edit  F7=Delete", "blue")
    for (const [col, h] of [
      [2, "Sel"],
      [6, "Item No"],
      [15, "Description"],
      [50, "Unit Price"],
      [68, "Stock"],
      [77, "Sts"],
    ] as const)
      buf.put(5, col, h, "ul")
    keys(buf, "F5=Add")
  },
  row(buf, line, i) {
    buf
      .put(line, 3, " ", "ul")
      .put(line, 6, editZ(i.itemNo, 7))
      .put(line, 15, i.description.slice(0, 30))
      .put(line, 47, editJ(i.unitPrice, 9, 2))
      .put(line, 62, editJ(i.stockQty, 9, 0))
      .put(line, 79, i.status)
  },
  label: (i) => `Item ${i.itemNo}, ${i.description}, ${i.stockQty} in stock`,
}
