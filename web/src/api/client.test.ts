import { afterEach, describe, expect, it, vi } from "vitest"

import { api, buildUrl } from "./client"
import { ApiError, fieldErrors, generalErrors } from "./errors"
import { traceStore } from "./trace-store"

function respond(status: number, body: unknown, headers: Record<string, string> = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body === undefined ? null : JSON.stringify(body), { status, headers })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
  traceStore.clear()
})

describe("buildUrl", () => {
  it("drops empty query values", () => {
    expect(buildUrl("/customers", { q: "", status: "A", page: 2, size: undefined })).toBe(
      "http://127.0.0.1:8000/api/customers?status=A&page=2",
    )
  })
})

describe("api()", () => {
  it("returns parsed JSON on success", async () => {
    respond(200, { custNo: 2001 })
    await expect(api("/customers/2001")).resolves.toEqual({ custNo: 2001 })
  })

  it("turns the §5.6 error contract into an ApiError", async () => {
    respond(409, {
      errors: [{ id: "COM0009", text: "Customer has orders.", field: null, line: null }],
      traceId: "abc123",
    })
    const e = await api("/customers/2001", { method: "DELETE" }).catch((x: unknown) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect((e as ApiError).status).toBe(409)
    expect((e as ApiError).id).toBe("COM0009")
    expect((e as ApiError).traceId).toBe("abc123")
  })

  it("flags 503 API0001 as backend down", async () => {
    respond(503, {
      errors: [{ id: "API0001", text: "Can't reach IBM i", field: null, line: null }],
      traceId: "x",
    })
    const e = (await api("/items").catch((x: unknown) => x)) as ApiError
    expect(e.isBackendDown).toBe(true)
  })

  it("reports status 0 when no response arrives", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")))
    const e = (await api("/health").catch((x: unknown) => x)) as ApiError
    expect(e.status).toBe(0)
    expect(e.isBackendDown).toBe(true)
  })

  it("records the X-COM-Trace steps, including non-ASCII targets", async () => {
    const json = JSON.stringify({
      traceId: "t1",
      steps: [{ kind: "PROC", target: "CUSTSVC_API → CUSTSVC (RPGLE)", action: "V", ms: 52, ok: true }],
    })
    const header = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
    respond(200, [], { "X-COM-Trace": header })
    await api("/customers")
    const [rec] = traceStore.getSnapshot()
    expect(rec?.traceId).toBe("t1")
    expect(rec?.steps[0]?.target).toBe("CUSTSVC_API → CUSTSVC (RPGLE)")
  })
})

describe("error helpers", () => {
  const errors = [
    { id: "COM0004", text: "Customer number must be greater than zero.", field: "custNo", line: null },
    { id: "COM0007", text: "Customer name cannot be blank.", field: "name", line: null },
    { id: "COM0033", text: "Database error.", field: null, line: null },
  ]
  it("maps field errors for the form", () =>
    expect(fieldErrors(errors)).toEqual({
      custNo: "Customer number must be greater than zero.",
      name: "Customer name cannot be blank.",
    }))
  it("keeps field-less errors for the summary", () =>
    expect(generalErrors(errors).map((e) => e.id)).toEqual(["COM0033"]))
})
