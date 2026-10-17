import { describe, expect, it } from "vitest"

import { formatCount, formatINR } from "./money"

describe("formatINR", () => {
  it("uses Indian digit grouping (lakh, crore)", () => {
    expect(formatINR("125000.00")).toBe("₹1,25,000.00")
    expect(formatINR("12345678.90")).toBe("₹1,23,45,678.90")
  })

  it("matches the seed order totals", () => {
    expect(formatINR("96850.00")).toBe("₹96,850.00")
    expect(formatINR("27900.00")).toBe("₹27,900.00")
  })

  it("keeps exact cents that a float would lose", () => {
    expect(formatINR("0.10")).toBe("₹0.10")
    expect(formatINR("9999999.99")).toBe("₹99,99,999.99")
  })

  it("shows an en dash for anything that isn't a decimal string", () => {
    expect(formatINR(undefined)).toBe("–")
    expect(formatINR("")).toBe("–")
    expect(formatINR("12,000")).toBe("–")
  })
})

describe("formatCount", () => {
  it("groups like INR", () => expect(formatCount(150000)).toBe("1,50,000"))
})
