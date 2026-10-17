import type { CSSProperties, ReactNode } from "react"
import { ArrowLeft } from "lucide-react"
import { Link, useLocation } from "react-router"

import { NAV } from "@/app/nav"
import { cn } from "@/lib/utils"

interface PageProps {
  title: ReactNode
  description?: ReactNode
  /** Small line above the title, e.g. the record number. */
  eyebrow?: ReactNode
  back?: { to: string; label: string }
  actions?: ReactNode
  /** Overrides the section's "Replaces …" lineage, e.g. for a detail screen. */
  footnote?: string
  children: ReactNode
}

/**
 * Standard page frame: lineage chip (which 5250 program this screen replaces), heading row, content.
 * Header and body rise in, in that order.
 */
export function Page({ title, description, eyebrow, back, actions, footnote, children }: PageProps) {
  const { pathname } = useLocation()
  const section = NAV.find((n) => (n.to === "/" ? pathname === "/" : pathname.startsWith(n.to)))
  const note = footnote ?? section?.replaces

  return (
    <div className="flex flex-col gap-7">
      <header className="flex rise flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {back && (
            <Link
              to={back.to}
              className="inline-flex w-fit items-center gap-1.5 rounded text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <ArrowLeft aria-hidden className="size-3.5" />
              {back.label}
            </Link>
          )}
          {note && <Lineage note={note} />}
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <div className="mb-1">{eyebrow}</div>}
            <h1 className="text-[2rem] leading-[1.05] font-semibold text-balance">{title}</h1>
            {description && <p className="mt-2 max-w-prose text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </header>

      <div className="flex rise flex-col gap-6" style={{ "--i": 1 } as CSSProperties}>
        {children}
      </div>
    </div>
  )
}

/** "Replaces ORDPGM · Order list" → a chip that says where this screen came from. */
function Lineage({ note }: { note: string }) {
  const replaces = note.startsWith("Replaces ")
  const text = replaces ? note.slice("Replaces ".length) : note.replace(/^New screen · /, "")
  return (
    <p
      className={cn(
        "inline-flex h-6 items-center gap-2 rounded-full border px-2.5 num text-[11px]",
        replaces ? "border-foreground/15 text-foreground/80" : "border-dashed text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn("size-1.5 rounded-[1px]", replaces ? "bg-primary" : "bg-muted-foreground/50")}
      />
      <span className="font-semibold tracking-wide uppercase">
        {replaces ? "Replaces" : "New on the web"}
      </span>
      <span aria-hidden className="text-muted-foreground">
        /
      </span>
      <span>{text}</span>
    </p>
  )
}
