/** "PUT /orders/10002" → "Save order 10002", so the inspector reads like what the user did. */
export function describeCall(method: string, path: string): string {
  const p = path.split("?")[0] ?? path
  const seg = p.split("/").filter(Boolean)
  const [res, id, sub] = seg
  const noun = { customers: "customer", items: "item", orders: "order" }[res ?? ""]

  if (res === "health") return "Check connection"
  if (res === "meta") return "Load COM messages"
  if (res === "dashboard") return "Load dashboard"
  if (res === "audit") return "Load audit log"
  if (!noun) return `${method} ${p}`

  if (id === "validate") return `Check ${noun}`
  if (sub === "audit") return `Load audit trail of order ${id}`
  if (!id) return method === "POST" ? (noun === "order" ? "Create order" : `Add ${noun}`) : `List ${res}`
  switch (method) {
    case "GET":
      return `Open ${noun} ${id}`
    case "PUT":
      return `Save ${noun} ${id}`
    case "DELETE":
      return `Delete ${noun} ${id}`
    default:
      return `${method} ${p}`
  }
}
