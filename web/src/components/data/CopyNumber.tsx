import { useState } from "react"
import { Check, Copy } from "lucide-react"

import { cn } from "@/lib/utils"

/** Copy an order / customer / item number to the clipboard; ticks for a moment once copied. */
export function CopyNumber({
  value,
  label,
  className,
}: {
  value: number | string
  label: string
  className?: string
}) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      aria-label={done ? `${label} copied` : `Copy ${label}`}
      title={done ? "Copied" : "Copy"}
      onClick={(e) => {
        e.stopPropagation()
        void navigator.clipboard?.writeText(String(value)).then(() => {
          setDone(true)
          setTimeout(() => setDone(false), 1200)
        })
      }}
      className={cn(
        "inline-grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        className,
      )}
    >
      {done ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
    </button>
  )
}
