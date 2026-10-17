import { config } from "@/config"

import { ApiError, isApiErrorBody, networkError } from "./errors"
import { decodeTraceHeader, traceStore } from "./trace-store"

type Query = Record<string, string | number | boolean | undefined | null>

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE"
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`/api${path}`, config.apiBase)
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v))
  }
  return url.toString()
}

/**
 * The only place that talks HTTP. Returns parsed JSON, or throws ApiError
 * (§5.6 error contract, or status 0 when no response arrived). Records the trace of every call.
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET"
  const started = performance.now()

  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      signal: opts.signal,
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") throw e
    const err = networkError()
    traceStore.add({
      traceId: "-",
      at: Date.now(),
      method,
      path,
      status: 0,
      ms: Math.round(performance.now() - started),
      steps: [],
      error: { id: err.id ?? "API0000", text: err.message },
    })
    throw err
  }

  const trace = decodeTraceHeader(res.headers.get("X-COM-Trace"))
  const record = (error?: { id: string; text: string }) =>
    traceStore.add({
      traceId: trace?.traceId ?? "-",
      at: Date.now(),
      method,
      path,
      status: res.status,
      ms: Math.round(performance.now() - started),
      steps: trace?.steps ?? [],
      ...(error ? { error } : {}),
    })

  const text = await res.text()
  let json: unknown = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!res.ok) {
    const err = isApiErrorBody(json)
      ? new ApiError(res.status, json.errors, json.traceId ?? trace?.traceId)
      : new ApiError(res.status, [
          { id: `HTTP${res.status}`, text: `Unexpected response (${res.status}).`, field: null, line: null },
        ])
    record({ id: err.id ?? `HTTP${res.status}`, text: err.message })
    throw err
  }
  record()
  return json as T
}
