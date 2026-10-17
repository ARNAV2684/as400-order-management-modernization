import { Fragment } from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { UnderTheHood } from "@/features/inspector/UnderTheHood"
import { useHotkey } from "@/lib/hotkeys"
import { panels, usePanel } from "@/lib/ui-state"

import { CommandPalette } from "./CommandPalette"

/** Handoff §6.6, with the green-screen key each one stands in for. */
const SHORTCUTS: { keys: string[]; action: string; was?: string }[] = [
  { keys: ["Ctrl", "K"], action: "Command palette: jump to a page, order, customer or item" },
  { keys: ["/"], action: "Search the list on this page" },
  { keys: ["Alt", "1–6"], action: "Go to a menu option (Dashboard … System)", was: "menu option number" },
  { keys: ["Alt", "G"], action: "Flip a list to its 5250 green-screen twin and back" },
  { keys: ["Alt", "N"], action: "New order / customer / item (list pages)", was: "F5 on the 5250 lists" },
  { keys: ["Alt", "S"], action: "Save (forms and the order editor)", was: "F10" },
  { keys: ["Esc"], action: "Cancel / close", was: "F12" },
  { keys: ["?"], action: "This list" },
]

/** Overlays any page can open (palette, inspector, shortcut list) and the keys that open them. */
export function GlobalOverlays() {
  const [helpOpen, setHelpOpen] = usePanel("shortcuts")

  useHotkey("mod+k", () => panels.toggle("palette"))
  useHotkey("?", () => panels.set("shortcuts", true))
  useHotkey("/", () => {
    // The list's own search box if the page has one; otherwise the palette.
    const search = document.querySelector<HTMLInputElement>("main input[type=search]")
    if (search) search.focus()
    else panels.set("palette", true)
  })

  return (
    <>
      <CommandPalette />
      <UnderTheHood />
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>
              F-keys stay with the browser (F5 reloads), so Alt combinations stand in for the green
              screen&apos;s.
            </DialogDescription>
          </DialogHeader>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-3 text-sm">
            {SHORTCUTS.map((s) => (
              <Fragment key={s.action}>
                <dt className="flex items-center gap-1">
                  {s.keys.map((k, i) => (
                    <Fragment key={k}>
                      {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                      <Kbd>{k}</Kbd>
                    </Fragment>
                  ))}
                </dt>
                <dd>
                  {s.action}
                  {s.was && <span className="ml-1.5 text-xs text-muted-foreground">({s.was})</span>}
                </dd>
              </Fragment>
            ))}
          </dl>
        </DialogContent>
      </Dialog>
    </>
  )
}
