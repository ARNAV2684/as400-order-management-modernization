const DECIMAL = /^-?\d+(\.\d+)?$/

// Intl formats a numeric *string* exactly (no float conversion), so "96850.10" never becomes 96850.09999.
const inr = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "125000.00" → "₹1,25,000.00". Anything that isn't a decimal string shows as an en dash. */
export function formatINR(value: string | null | undefined): string {
  if (value == null || !DECIMAL.test(value)) return "–"
  return inr.format(value as Intl.StringNumericLiteral)
}

/** Plain count with Indian grouping: 125000 → "1,25,000". */
export function formatCount(n: number): string {
  return n.toLocaleString("en-IN")
}
