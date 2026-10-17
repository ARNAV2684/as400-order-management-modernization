import { useCallback } from "react"
import { useSearchParams } from "react-router"

/**
 * List filters live in the URL (?q=&status=&page=), so Back, refresh and shared links keep them.
 * Any filter change resets to page 1.
 */
export function useListParams<K extends string>(keys: readonly K[]) {
  const [params, setParams] = useSearchParams()

  const get = (k: K | "page") => params.get(k) ?? ""
  const page = Math.max(1, Number(params.get("page")) || 1)

  const set = useCallback(
    (changes: Partial<Record<K | "page", string | number | null>>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(changes) as [string, string | number | null][]) {
            if (v === null || v === "" || (k === "page" && Number(v) <= 1)) next.delete(k)
            else next.set(k, String(v))
          }
          if (!("page" in changes)) next.delete("page")
          return next
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const values = Object.fromEntries(keys.map((k) => [k, get(k)])) as Record<K, string>
  return { values, page, set }
}
