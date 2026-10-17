import type { TraceRecord, TraceStep } from "./types"

/**
 * Last 50 API calls with their IBM i steps (from the X-COM-Trace header).
 * Feeds the "Under the hood" drawer (Sprint 13). A plain store so it works outside React.
 */
const MAX = 50
let records: TraceRecord[] = []
const listeners = new Set<() => void>()

export const traceStore = {
  add(record: TraceRecord) {
    records = [record, ...records].slice(0, MAX)
    listeners.forEach((l) => l())
  },
  clear() {
    records = []
    listeners.forEach((l) => l())
  },
  getSnapshot(): TraceRecord[] {
    return records
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
}

/** Header value is base64 of compact JSON: {traceId, steps}. Returns null on anything malformed. */
export function decodeTraceHeader(value: string | null): { traceId: string; steps: TraceStep[] } | null {
  if (!value) return null
  try {
    // The header is base64 of UTF-8 JSON (step targets contain "→"), so decode bytes, not Latin-1 chars.
    const bytes = Uint8Array.from(atob(value), (c) => c.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { traceId?: unknown }).traceId === "string" &&
      Array.isArray((parsed as { steps?: unknown }).steps)
    ) {
      return parsed as { traceId: string; steps: TraceStep[] }
    }
  } catch {
    // ignore: a missing trace must never break the call itself
  }
  return null
}
