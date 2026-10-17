import { useCallback } from "react"
import { useSearchParams } from "react-router"

/** ?view=5250 shows a list's green-screen twin. In the URL, so a shared link opens the same view. */
export function useScreenView(): [boolean, (on: boolean) => void] {
  const [params, setParams] = useSearchParams()
  const on = params.get("view") === "5250"
  const set = useCallback(
    (next: boolean) =>
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          if (next) p.set("view", "5250")
          else p.delete("view")
          return p
        },
        { replace: true },
      ),
    [setParams],
  )
  return [on, set]
}
