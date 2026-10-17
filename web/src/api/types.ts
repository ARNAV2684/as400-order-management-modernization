/*
 * API contract types, written by hand from the API design (field mapping and JSON shapes).
 * Checked field by field against the FastAPI models (../api/app/schemas.py) in Sprint 10.
 * Money is always a decimal string ("96850.00"), never a number.
 */

export type DecimalString = string
export type IsoDate = string // "YYYY-MM-DD"
export type Status = "A" | "I"

export interface Page<T> {
  items: T[]
  page: number
  size: number
  total: number
}

// ---------------------------------------------------------------- errors (§5.6)

export interface ApiErrorItem {
  /** COMxxxx from COMMSGF, or APIxxxx for API-level failures. */
  id: string
  text: string
  field: string | null
  /** Zero-based index into the request's lines array; null for header errors. */
  line: number | null
}

export interface ApiErrorBody {
  errors: ApiErrorItem[]
  traceId: string
}

/** Result of a /validate call: HTTP 200 even when invalid (it is a check, not a failure). */
export interface ValidateResult {
  valid: boolean
  errors: ApiErrorItem[]
}

/** Success body of every write: the COM message text (COM0025/26/27, COM0034/35). */
export interface SaveResult {
  message: string
}

// ---------------------------------------------------------------- system

export interface Health {
  api: "ok"
  tunnel: "ok" | "down"
  db: "ok" | "down"
  latencyMs: number | null
  system: string
  library: string
  /** How the API reaches IBM i: the SSH tunnel, or PUB400 directly (plain = unencrypted). */
  connection: "tunnel" | "direct-plain" | "direct-tls"
}

export interface ComMessage {
  id: string
  text: string
}

export interface TraceStep {
  kind: "SQL" | "PROC"
  /** e.g. "ORDSVC_API → ORDSVC (RPGLE)" or "SELECT CSTMST" */
  target: string
  action: string | null
  ms: number
  ok: boolean
}

export interface TraceRecord {
  traceId: string
  /** When the call finished (epoch ms). */
  at: number
  method: string
  path: string
  /** 0 = no response at all (API not running). */
  status: number
  ms: number
  steps: TraceStep[]
  /** First message of a failed call, e.g. COM0019. */
  error?: { id: string; text: string }
}

// ---------------------------------------------------------------- customers (CSTMST)

export interface Customer {
  custNo: number
  name: string
  address: string
  city: string
  state: string
  status: Status
}

export interface CustomerDetail extends Customer {
  orderCount: number
}

export type CustomerInput = Customer

export interface CustomerQuery {
  q?: string
  status?: Status
  page?: number
  size?: number
}

// ---------------------------------------------------------------- items (ITMMST)

export interface Item {
  itemNo: number
  description: string
  category: string
  unitPrice: DecimalString
  stockQty: number
  status: Status
}

export interface ItemDetail extends Item {
  orderLineCount: number
}

export type ItemInput = Item

export interface ItemQuery {
  q?: string
  status?: Status
  inStock?: boolean
  page?: number
  size?: number
}

// ---------------------------------------------------------------- orders (ORDHDR / ORDDTL)

/** One row of the order list (reads the ORDSUMV view: header + customer name + line count). */
export interface OrderSummary {
  ordNo: number
  orderDate: IsoDate
  custNo: number
  customerName: string
  lineCount: number
  status: "O"
  total: DecimalString
}

export interface OrderLine {
  lineNo: number
  itemNo: number
  description: string
  qty: number
  price: DecimalString
  amount: DecimalString
}

export interface OrderDetail extends OrderSummary {
  lines: OrderLine[]
  /** Fingerprint of header + lines when read; sent back on edit so a stale save gets COM0039. */
  checksum: string
}

export type OrderSortField = "ordNo" | "orderDate" | "custNo" | "total"
/** "ordNo" ascending, "-ordNo" descending. */
export type OrderSort = OrderSortField | `-${OrderSortField}`

export interface OrderQuery {
  custNo?: number
  sort?: OrderSort
  page?: number
  size?: number
}

// ---------------------------------------------------------------- audit (ORDAUD)

export type AuditAction = "A" | "U" | "D"
export type AuditSource = "WEB" | "5250"

export interface AuditEntry {
  ordNo: number
  action: AuditAction
  /** AUDDATE + AUDTIME, local ISO datetime. */
  at: string
  user: string
  source: AuditSource
}

// ---------------------------------------------------------------- order entry (§5.5)

/** N = new line · C = existing line kept / changed · D = existing line deleted (ORDSVC LACTION). */
export type LineAction = "N" | "C" | "D"

export interface OrderDraftLine {
  /** 0 for a new line; the RPG numbers it on save (A6). */
  lineNo: number
  action: LineAction
  itemNo: number
  qty: number
}

/** Body of validate / create / edit. Mirrors ORDSVC's parameters (P_ORDNO, P_ORDDATE, P_CUSTNO, P_LINES, P_CHKSUM). */
export interface OrderDraft {
  /** 0 = add (VA / SA); the order number = edit (VE / SE). */
  ordNo: number
  orderDate: IsoDate
  custNo: number
  /** Only on edit: the fingerprint from when the order was loaded (stale-edit check, COM0039). */
  checksum?: string
  lines: OrderDraftLine[]
}

/** One request line after the RPG filled description / price / amount. `index` = position in the request. */
export interface ValidatedLine {
  index: number
  lineNo: number
  itemNo: number
  qty: number
  description: string
  price: DecimalString | null
  amount: DecimalString | null
}

export interface OrderValidateResult {
  valid: boolean
  customerName: string
  total: DecimalString
  lines: ValidatedLine[]
  errors: ApiErrorItem[]
}

export interface CreateOrderResult {
  ordNo: number
  message: string
}

export interface AuditQuery {
  ordNo?: number
  action?: AuditAction
  source?: AuditSource
  page?: number
  size?: number
}

// ---------------------------------------------------------------- dashboard (§5.4)

export interface DashboardData {
  kpis: {
    openOrders: number
    orderValue: DecimalString
    activeCustomers: number
    /** Active items with stock ≤ 5. */
    lowStockItems: number
  }
  /** One entry per day for the last 30 days, oldest first, zero days included. */
  valueByDay: { date: IsoDate; value: DecimalString; orders: number }[]
  /** Top 5 items by quantity on orders. */
  topItems: { itemNo: number; description: string; qty: number }[]
  lowStock: Item[]
  recentOrders: OrderSummary[]
  recentAudit: AuditEntry[]
}
