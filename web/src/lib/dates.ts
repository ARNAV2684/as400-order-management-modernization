import { format, isValid, parseISO } from "date-fns"

/** "2026-09-28" → "28/09/2026" (display format from handoff §6.1). */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "–"
  const d = parseISO(iso)
  return isValid(d) ? format(d, "dd/MM/yyyy") : "–"
}

/** "2026-09-28T10:14:05" → "28/09/2026 10:14". */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "–"
  const d = parseISO(iso)
  return isValid(d) ? format(d, "dd/MM/yyyy HH:mm") : "–"
}
