import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface SearchInputProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  label: string
  className?: string
  debounceMs?: number
}

/** Search box that types instantly but only reports the value after a short pause. */
export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
  className,
  debounceMs = 300,
}: SearchInputProps) {
  const [draft, setDraft] = useState(value)
  const [lastValue, setLastValue] = useState(value)
  // Follow outside changes (Back button, cleared filters): adjust state during render, no effect needed.
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value)
  }

  // Keep the newest onChange without restarting the debounce timer on every parent render.
  const latest = useRef(onChange)
  useLayoutEffect(() => {
    latest.current = onChange
  })

  useEffect(() => {
    if (draft === value) return
    const t = setTimeout(() => latest.current(draft.trim()), debounceMs)
    return () => clearTimeout(t)
  }, [draft, value, debounceMs])

  return (
    <div className={cn("relative", className)}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        aria-label={label}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape" && draft) {
            e.stopPropagation()
            setDraft("")
          }
        }}
        className="h-9 bg-card pr-8 pl-8 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setDraft("")}
          className="absolute top-1/2 right-1.5 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
