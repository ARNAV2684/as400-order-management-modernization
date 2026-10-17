import type { ApiErrorBody, ApiErrorItem } from "./types"

/** Every failed API call becomes one of these, so screens never parse responses themselves. */
export class ApiError extends Error {
  readonly status: number
  readonly errors: ApiErrorItem[]
  readonly traceId: string | null

  constructor(status: number, errors: ApiErrorItem[], traceId: string | null = null) {
    super(errors[0]?.text ?? `Request failed (${status})`)
    this.name = "ApiError"
    this.status = status
    this.errors = errors
    this.traceId = traceId
  }

  /** First message ID, e.g. "COM0009". */
  get id(): string | null {
    return this.errors[0]?.id ?? null
  }

  has(id: string): boolean {
    return this.errors.some((e) => e.id === id)
  }

  /** IBM i unreachable (503 API0001) or the API itself down (status 0). */
  get isBackendDown(): boolean {
    return this.status === 0 || this.status === 503
  }
}

/** Status 0 = the browser never got a response (API not running). */
export function networkError(): ApiError {
  return new ApiError(0, [
    {
      id: "API0000",
      text: "Can't reach the COM API. Is it running on 127.0.0.1:8000?",
      field: null,
      line: null,
    },
  ])
}

export function isApiErrorBody(v: unknown): v is ApiErrorBody {
  return (
    typeof v === "object" &&
    v !== null &&
    Array.isArray((v as { errors?: unknown }).errors) &&
    (v as { errors: unknown[] }).errors.every(
      (e) => typeof e === "object" && e !== null && typeof (e as { id?: unknown }).id === "string",
    )
  )
}

/** Header-level errors keyed by field, for react-hook-form setError. First message per field wins. */
export function fieldErrors(errors: ApiErrorItem[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const e of errors) {
    if (e.field && e.line === null && !(e.field in out)) out[e.field] = e.text
  }
  return out
}

/** Errors that are not tied to a field (shown in the summary at the top of a form). */
export function generalErrors(errors: ApiErrorItem[]): ApiErrorItem[] {
  return errors.filter((e) => !e.field)
}
