import { useSyncExternalStore } from "react"

/**
 * App-wide open/closed flags for overlays that several places can open (top bar, command palette,
 * keyboard shortcuts). A tiny external store: no provider needed, works outside React too.
 */
type Panel = "inspector" | "palette" | "shortcuts"

const open: Record<Panel, boolean> = { inspector: false, palette: false, shortcuts: false }
const listeners = new Set<() => void>()

export const panels = {
  set(panel: Panel, value: boolean) {
    if (open[panel] === value) return
    open[panel] = value
    listeners.forEach((l) => l())
  },
  toggle(panel: Panel) {
    panels.set(panel, !open[panel])
  },
}

export function usePanel(panel: Panel): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => open[panel],
  )
  return [value, (v) => panels.set(panel, v)]
}
