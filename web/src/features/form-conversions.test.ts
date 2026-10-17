import { describe, expect, it } from "vitest"

import { toInput as customerInput, customerSchema } from "./customers/customer-form"
import { emptyItem, itemSchema, toInput } from "./items/item-form"

const item = { ...emptyItem, itemNo: "5009", description: "usb hub", category: "accessories" }

describe("item form → API body", () => {
  it("pads the price to two decimals as a string", () => {
    expect(toInput({ ...item, unitPrice: "1250" }).unitPrice).toBe("1250.00")
    expect(toInput({ ...item, unitPrice: "1250.5" }).unitPrice).toBe("1250.50")
    expect(toInput({ ...item, unitPrice: "-5" }).unitPrice).toBe("-5.00")
  })

  it("stores text in capitals, like the green screen", () => {
    const body = toInput({ ...item, unitPrice: "1" })
    expect(body.description).toBe("USB HUB")
    expect(body.category).toBe("ACCESSORIES")
  })

  it("lets negatives through so the RPG can answer COM0015 / COM0016", () => {
    expect(itemSchema.safeParse({ ...item, unitPrice: "-5", stockQty: "-1" }).success).toBe(true)
  })

  it("rejects shapes the RPG could never receive", () => {
    expect(itemSchema.safeParse({ ...item, unitPrice: "12,50" }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, unitPrice: "12345678" }).success).toBe(false)
    expect(itemSchema.safeParse({ ...item, unitPrice: "1.234" }).success).toBe(false)
  })
})

describe("customer form", () => {
  const base = { custNo: "0", name: "", address: "", city: "", state: "", status: "A" as const }

  it("passes 0 and a blank name through: those are RPG rules (COM0004, COM0007)", () => {
    expect(customerSchema.safeParse(base).success).toBe(true)
  })

  it("rejects a non-numeric or 8-digit number", () => {
    expect(customerSchema.safeParse({ ...base, custNo: "20O1" }).success).toBe(false)
    expect(customerSchema.safeParse({ ...base, custNo: "12345678" }).success).toBe(false)
  })

  it("uppercases and trims trailing blanks", () => {
    expect(customerInput({ ...base, custNo: "2006", name: "mehta  " }).name).toBe("MEHTA")
  })
})
