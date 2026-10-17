import { describe, expect, it } from "vitest"

import { describeCall } from "./describe-call"

describe("describeCall", () => {
  it.each([
    ["GET", "/health", "Check connection"],
    ["GET", "/customers", "List customers"],
    ["GET", "/customers/2001", "Open customer 2001"],
    ["POST", "/customers/validate", "Check customer"],
    ["POST", "/customers", "Add customer"],
    ["PUT", "/items/5004", "Save item 5004"],
    ["DELETE", "/items/5007", "Delete item 5007"],
    ["POST", "/orders/validate", "Check order"],
    ["POST", "/orders", "Create order"],
    ["PUT", "/orders/10002", "Save order 10002"],
    ["GET", "/orders/10002/audit", "Load audit trail of order 10002"],
    ["GET", "/dashboard", "Load dashboard"],
    ["GET", "/audit", "Load audit log"],
  ])("%s %s → %s", (method, path, label) => {
    expect(describeCall(method, path)).toBe(label)
  })
})
