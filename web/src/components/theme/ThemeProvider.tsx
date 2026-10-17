import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"

import { THEME_STORAGE_KEY, ThemeContext, type Theme } from "./theme-context"

const darkQuery = "(prefers-color-scheme: dark)"

function readStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY)
    if (v === "light" || v === "dark" || v === "system") return v
  } catch {
    // Storage blocked (private window): fall back to the OS setting.
  }
  return "system"
}

function systemPrefersDark(): boolean {
  return window.matchMedia(darkQuery).matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const mq = window.matchMedia(darkQuery)
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  const resolved = theme === "system" ? (systemDark ? "dark" : "light") : theme

  // index.html sets the class before React loads (no flash); this keeps it in sync afterwards.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark")
  }, [resolved])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // Not persisted; the choice still applies for this visit.
    }
  }, [])

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
