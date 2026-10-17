import type { ReactNode } from "react"
import { Monitor, SquareTerminal } from "lucide-react"

import { useHotkey } from "@/lib/hotkeys"
import { cn } from "@/lib/utils"

/** "Web | 5250" switch for a list page header; Alt+G flips it. */
export function ScreenToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  useHotkey("alt+g", () => onChange(!on))
  return (
    <div
      role="group"
      aria-label="View"
      className="inline-flex h-9 items-center rounded-md border bg-card p-0.5 num text-xs font-medium"
    >
      <Option active={!on} onClick={() => onChange(false)} label="Web">
        <Monitor aria-hidden className="size-3.5" />
      </Option>
      <Option active={on} onClick={() => onChange(true)} label="5250" phosphor>
        <SquareTerminal aria-hidden className="size-3.5" />
      </Option>
    </div>
  )
}

function Option({
  active,
  onClick,
  label,
  phosphor,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  phosphor?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-keyshortcuts="Alt+G"
      onClick={onClick}
      className={cn(
        "inline-flex h-full items-center gap-1.5 rounded-[4px] px-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? phosphor
            ? "bg-crt text-phosphor shadow-[inset_0_0_0_1px] shadow-phosphor/30"
            : "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {label}
    </button>
  )
}
