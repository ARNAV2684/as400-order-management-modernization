import { useRef, useState, type KeyboardEvent } from "react"

import { cn } from "@/lib/utils"

import { ROWS, ScreenBuffer, type Attr } from "./screen-buffer"
import type { ListScreen, ScreenContext } from "./screens"

const ATTR: Record<Attr, string> = {
  n: "text-phosphor",
  hi: "font-semibold text-phosphor-bright",
  blue: "text-phosphor-blue",
  ul: "text-phosphor underline decoration-phosphor-dim underline-offset-[3px]",
}

// The system's own message when you roll past the end (CPF5... on a real 5250).
const ROLL_MSG = "Roll up or down past first or last record in file."

interface GreenScreenProps<T> {
  screen: ListScreen<T>
  rows: T[] | undefined
  ctx: ScreenContext
  /** More rows on the server after this API page (SFLEND shows "More..." instead of "Bottom"). */
  hasNext: boolean
  /** Request in flight: the 5250 locks the keyboard and shows X SYSTEM on the status line. */
  loading?: boolean
  hasPrev: boolean
  onNextPage: () => void
  onPrevPage: () => void
  onOpen: (row: T) => void
  onExit: () => void
}

/**
 * The 5250 twin of a list: the same live rows, drawn where the DDS puts them. Behaves like the
 * green screen: a row = "X + Enter", Page Down / Up = the Roll keys (SFLPAG rows at a time), Esc
 * = back to the web view. Give it `key={apiPage}` so a new API page starts at its top, like a
 * reloaded subfile.
 */
export function GreenScreen<T>({
  screen,
  rows = [],
  ctx,
  hasNext,
  hasPrev,
  loading = false,
  onNextPage,
  onPrevPage,
  onOpen,
  onExit,
}: GreenScreenProps<T>) {
  const [offset, setOffset] = useState(0)
  const [focused, setFocused] = useState<number | null>(null)
  const [message, setMessage] = useState("")
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([])

  const page = rows.slice(offset, offset + screen.sflPag)
  const moreHere = offset + screen.sflPag < rows.length
  const buf = new ScreenBuffer()
  screen.header(buf, ctx)
  page.forEach((r, i) => {
    screen.row(buf, screen.sflStart + i, r)
    if (i === focused) buf.put(screen.sflStart + i, 3, "X", "ul")
  })
  const endRow = screen.sflStart + screen.sflPag
  if (rows.length) buf.put(endRow, moreHere || hasNext ? 74 : 75, moreHere || hasNext ? "More..." : "Bottom")
  else if (!loading) buf.put(screen.sflStart, 6, "(No records to display.)")
  if (loading) buf.put(24, 2, "X SYSTEM", "hi")
  else if (message) buf.put(24, 2, message, "hi")

  const roll = (down: boolean) => {
    setMessage("")
    if (down) {
      if (moreHere) setOffset(offset + screen.sflPag)
      else if (hasNext) onNextPage()
      else setMessage(ROLL_MSG)
    } else if (offset > 0) setOffset(Math.max(0, offset - screen.sflPag))
    else if (hasPrev) onPrevPage()
    else setMessage(ROLL_MSG)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "PageDown" || e.key === "PageUp") {
      e.preventDefault()
      roll(e.key === "PageDown")
    } else if (e.key === "Escape") {
      e.preventDefault()
      onExit()
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const next = Math.min(page.length - 1, Math.max(0, (focused ?? -1) + (e.key === "ArrowDown" ? 1 : -1)))
      rowRefs.current[next]?.focus()
    }
  }

  return (
    <figure className="m-0 rise">
      <div className="rounded-xl bg-[#1b1e1c] p-2.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.55)] ring-1 ring-black/40 sm:p-3.5">
        <div
          role="group"
          aria-label={`5250 view: ${screen.formats}. Page Down and Page Up roll the list, Escape returns to the web view.`}
          onKeyDown={onKeyDown}
          className="@container relative overflow-hidden rounded-md bg-crt px-[2.5%] py-[2%]"
        >
          <div
            className="relative z-0 num leading-[1.45] whitespace-pre [text-shadow:0_0_6px_rgb(61_255_122/0.4)]"
            style={{ fontSize: "clamp(8px, calc(100cqw / 50), 15px)" }}
          >
            {Array.from({ length: ROWS }, (_, r) => {
              const line = r + 1
              const idx = line - screen.sflStart
              const item = idx >= 0 && idx < page.length ? page[idx] : undefined
              const content = buf.runs(line).map((run, k) => (
                <span
                  key={k}
                  className={cn(
                    ATTR[run.attr],
                    item !== undefined &&
                      "group-hover:text-crt! group-hover:[text-shadow:none] group-focus-visible:text-crt! group-focus-visible:[text-shadow:none]",
                  )}
                >
                  {run.text}
                </span>
              ))
              return item !== undefined ? (
                <button
                  key={line}
                  ref={(el) => {
                    rowRefs.current[idx] = el
                  }}
                  type="button"
                  aria-label={screen.label(item)}
                  onClick={() => onOpen(item)}
                  onFocus={() => setFocused(idx)}
                  onBlur={() => setFocused((f) => (f === idx ? null : f))}
                  className="group block w-full cursor-pointer text-left outline-none hover:bg-phosphor focus-visible:bg-phosphor"
                >
                  {content}
                </button>
              ) : (
                <div key={line} aria-hidden={buf.text(line).trim() === "" || undefined}>
                  {content}
                </div>
              )
            })}
          </div>
          {/* scanlines + vignette: glass, not data */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-10 [background:repeating-linear-gradient(to_bottom,rgb(0_0_0/0.22)_0,rgb(0_0_0/0.22)_1px,transparent_1px,transparent_3px),radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.55))]"
          />
        </div>
      </div>
      <figcaption className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 num text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          5250 twin · {screen.formats} · live data, DDS layout
        </span>
        <span className="sm:ml-auto">Click / Enter = X · PgDn PgUp = Roll · Esc = web view</span>
      </figcaption>
    </figure>
  )
}
