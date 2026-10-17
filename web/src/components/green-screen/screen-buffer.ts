/*
 * A 24 × 80 5250 screen as text, built from the same row / column positions as the DDS
 * (ORDDSPF, CUSTDSPF, ITEMDSPF), with the display attributes the DDS asks for.
 */

export const ROWS = 24
export const COLS = 80

/** n = normal green · hi = DSPATR(HI) · blue = COLOR(BLU) · ul = DSPATR(UL) */
export type Attr = "n" | "hi" | "blue" | "ul"

export interface Cell {
  ch: string
  attr: Attr
}

export class ScreenBuffer {
  readonly cells: Cell[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ ch: " ", attr: "n" as Attr })),
  )

  /** Same coordinates as DDS: row and column are 1-based. Text past column 80 is cut, as on a 5250. */
  put(row: number, col: number, text: string, attr: Attr = "n"): this {
    const line = this.cells[row - 1]
    if (!line) return this
    for (let i = 0; i < text.length && col - 1 + i < COLS; i++) line[col - 1 + i] = { ch: text[i], attr }
    return this
  }

  /** One row as runs of equal attribute, for rendering. */
  runs(row: number): { text: string; attr: Attr }[] {
    const out: { text: string; attr: Attr }[] = []
    for (const c of this.cells[row - 1]) {
      const last = out[out.length - 1]
      if (last && last.attr === c.attr) last.text += c.ch
      else out.push({ text: c.ch, attr: c.attr })
    }
    return out
  }

  text(row: number): string {
    return this.cells[row - 1].map((c) => c.ch).join("")
  }
}

const group3 = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",")

/** EDTCDE(Z): no zero digits, no sign; blanks for zero; right-aligned in the field's length. */
export function editZ(n: number, len: number): string {
  return (n === 0 ? "" : String(Math.trunc(Math.abs(n)))).padStart(len, " ")
}

function splitDecimal(value: string | number, dec: number): { int: string; frac: string; neg: boolean } {
  const s = typeof value === "number" ? value.toFixed(dec) : value.trim()
  const neg = s.startsWith("-")
  const [i = "0", f = ""] = s.replace("-", "").split(".")
  return { int: i.replace(/^0+(?=\d)/, ""), frac: f.padEnd(dec, "0").slice(0, dec), neg }
}

/** Width the edited field takes on the screen: digits + commas + decimal point (+ sign for J). */
function editWidth(digits: number, dec: number, sign: boolean): number {
  const intDigits = digits - dec
  return intDigits + Math.floor((intDigits - 1) / 3) + (dec > 0 ? 1 + dec : 0) + (sign ? 1 : 0)
}

/** EDTCDE(1): commas, decimal point, zero shows as .00, no sign. */
export function edit1(value: string | number, digits: number, dec: number): string {
  const { int, frac } = splitDecimal(value, dec)
  const body = (int === "0" ? "" : group3(int)) + (dec ? `.${frac}` : "")
  return body.padStart(editWidth(digits, dec, false), " ")
}

/** EDTCDE(J): like 1, plus a trailing minus for negatives. */
export function editJ(value: string | number, digits: number, dec: number): string {
  const { int, frac, neg } = splitDecimal(value, dec)
  const body =
    (int === "0" ? "" : group3(int)) + (dec ? `.${frac}` : int === "0" ? "0" : "") + (neg ? "-" : " ")
  return body.padStart(editWidth(digits, dec, true), " ")
}

/** EDTCDE(Y) on DATE: the job date as dd/mm/yy. */
export function editDateY(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${p(d.getFullYear() % 100)}`
}

/** ORDPGM's FmtDate: ISO → dd/mm/yyyy. */
export function fmtDateEur(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}
