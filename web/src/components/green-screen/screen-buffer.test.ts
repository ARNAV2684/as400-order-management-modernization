import { describe, expect, it } from "vitest"

import { edit1, editDateY, editJ, editZ, fmtDateEur, ScreenBuffer } from "./screen-buffer"

describe("5250 edit codes", () => {
  it("Z suppresses zeros and right-aligns", () => {
    expect(editZ(10001, 7)).toBe("  10001")
    expect(editZ(0, 7)).toBe("       ")
  })

  it("1 adds commas and the decimal point (11,2 → 14 wide, like LTOTAL)", () => {
    expect(edit1("96850.00", 11, 2)).toBe("     96,850.00")
    expect(edit1("96850.00", 11, 2)).toHaveLength(14)
    expect(edit1("0.00", 11, 2)).toBe("           .00")
  })

  it("J adds a trailing sign position (UNITPRICE 9,2 → 13, STOCKQTY 9,0 → 12)", () => {
    expect(editJ("45000.00", 9, 2)).toBe("   45,000.00 ")
    expect(editJ("45000.00", 9, 2)).toHaveLength(13)
    expect(editJ(20, 9, 0)).toBe("         20 ")
    expect(editJ(0, 9, 0)).toBe("          0 ")
    expect(editJ(-5, 9, 0)).toBe("          5-")
  })

  it("formats dates the way the DSPFs show them", () => {
    expect(editDateY(new Date(2026, 9, 15))).toBe("15/10/26")
    expect(fmtDateEur("2026-09-28")).toBe("28/09/2026")
  })
})

describe("ScreenBuffer", () => {
  it("places text at DDS coordinates and cuts at column 80", () => {
    const s = new ScreenBuffer().put(1, 2, "ORDLIST").put(1, 76, "Total+more")
    expect(s.text(1).slice(1, 8)).toBe("ORDLIST")
    expect(s.text(1).slice(75)).toBe("Total") // columns 76–80
    expect(s.text(1)).toHaveLength(80)
  })

  it("groups a row into runs by attribute", () => {
    const s = new ScreenBuffer().put(2, 1, "AB", "hi").put(2, 3, "C", "blue")
    expect(s.runs(2).slice(0, 2)).toEqual([
      { text: "AB", attr: "hi" },
      { text: "C", attr: "blue" },
    ])
  })
})
