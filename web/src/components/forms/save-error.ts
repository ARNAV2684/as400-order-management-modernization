import type { ApiError } from "@/api/errors"

/** Headline for a failed save; the COM message itself is listed under it. */
export function saveErrorTitle(e: ApiError): string {
  if (e.isBackendDown) return "Can't reach IBM i. Nothing was saved."
  if (e.has("COM0033")) return "Nothing was saved. All changes were rolled back."
  if (e.has("COM0038")) return "Someone else is editing this record. Try again in a moment."
  if (e.has("COM0039")) return "This record was changed elsewhere. Reload it before saving."
  if (e.status === 422 || e.status === 409) return "Fix the highlighted fields."
  return "Couldn't save."
}
