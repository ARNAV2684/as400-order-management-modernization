import { createContext, useContext } from "react"

export type Theme = "light" | "dark" | "system"

export const THEME_STORAGE_KEY = "com-theme"

export interface ThemeState {
  theme: Theme
  /** What is actually on screen once "system" is resolved. */
  resolved: "light" | "dark"
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}
