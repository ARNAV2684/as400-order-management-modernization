import { useEffect, useRef } from "react"

/*
 * Keyboard shortcuts (handoff §6.6). Browser-safe on purpose: F-keys stay the browser's (F5 = reload),
 * so Alt+N / Alt+S stand in for the green screen's F6 / F10, and Esc for F12 (Radix dialogs handle Esc).
 *
 * Combos: "alt+n", "mod+k" (Ctrl on Windows, Cmd on Mac), "/", "?".
 */

type KeyInfo = Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey">

export function matchesCombo(e: KeyInfo, combo: string): boolean {
  const parts = combo.toLowerCase().split("+")
  const key = parts.pop() ?? ""
  const alt = parts.includes("alt")
  const mod = parts.includes("mod")
  if (e.altKey !== alt) return false
  if ((e.ctrlKey || e.metaKey) !== mod) return false
  // Letters by physical key: with Alt / Option held, e.key can be "˜" (Mac) instead of "n".
  if (/^[a-z]$/.test(key)) return e.code === `Key${key.toUpperCase()}`
  return e.key === key // "/", "?" (shift is part of producing "?")
}

/** Typing in a field must not trigger single-key shortcuts like "/" or "?". */
export function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
}

interface Options {
  enabled?: boolean
  /** Fire even while focus is in an input (true for Alt / Ctrl combos, which can't be typed). */
  inInputs?: boolean
}

export function useHotkey(combo: string, handler: (e: KeyboardEvent) => void, opts: Options = {}) {
  const { enabled = true, inInputs = combo.includes("+") } = opts
  const latest = useRef(handler)
  useEffect(() => {
    latest.current = handler
  })

  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !matchesCombo(e, combo)) return
      if (!inInputs && isTyping(e.target)) return
      e.preventDefault()
      latest.current(e)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [combo, enabled, inInputs])
}
