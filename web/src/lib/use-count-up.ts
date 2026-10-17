import { useEffect, useState } from "react"

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches

/**
 * Counts from 0 to `target` once (ease-out), for the dashboard figures. Reduced motion, or a
 * non-finite target, shows the final value straight away.
 */
export function useCountUp(target: number, durationMs = 900): number {
  const instant = reducedMotion() || !Number.isFinite(target)
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (instant) return
    let frame = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      setValue(target * (1 - (1 - t) ** 3))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, instant])

  return instant ? target : value
}
