import { describe, expect, it } from "vitest"

import { matchesCombo } from "./hotkeys"

const key = (over: Partial<KeyboardEvent>) =>
  ({
    key: "",
    code: "",
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    ...over,
  }) as KeyboardEvent

describe("matchesCombo", () => {
  it("matches Alt+N by physical key, even when the Mac types ˜", () => {
    expect(matchesCombo(key({ key: "n", code: "KeyN", altKey: true }), "alt+n")).toBe(true)
    expect(matchesCombo(key({ key: "˜", code: "KeyN", altKey: true }), "alt+n")).toBe(true)
  })

  it("needs exactly the modifiers asked for", () => {
    expect(matchesCombo(key({ key: "n", code: "KeyN" }), "alt+n")).toBe(false)
    expect(matchesCombo(key({ key: "n", code: "KeyN", altKey: true, ctrlKey: true }), "alt+n")).toBe(false)
  })

  it("treats Ctrl and Cmd alike for mod", () => {
    expect(matchesCombo(key({ key: "k", code: "KeyK", ctrlKey: true }), "mod+k")).toBe(true)
    expect(matchesCombo(key({ key: "k", code: "KeyK", metaKey: true }), "mod+k")).toBe(true)
  })

  it("matches / and ? by character", () => {
    expect(matchesCombo(key({ key: "/", code: "Slash" }), "/")).toBe(true)
    expect(matchesCombo(key({ key: "?", code: "Slash", shiftKey: true }), "?")).toBe(true)
    expect(matchesCombo(key({ key: "/", code: "Slash", ctrlKey: true }), "/")).toBe(false)
  })
})
