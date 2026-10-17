import type { ReactNode } from "react"
import { BookOpenCheck, PenLine } from "lucide-react"

import { useHealth } from "@/api/hooks/system"
import { Pill } from "@/components/data/StatusBadge"
import { Page } from "@/components/layout/Page"
import { config } from "@/config"

import { ArchitectureDiagram } from "./ArchitectureDiagram"

type Stage = { label: string; built: boolean }

/** What sits behind each screen. every object is built in ARNAV27122 on PUB400. */
const OBJECTS: { screen: string; greenScreen: Stage; writes: Stage; reads: string }[] = [
  {
    screen: "Customers",
    greenScreen: { label: "CUSTPGM · Sprint 2", built: true },
    writes: { label: "CUSTSVC_API → CUSTSVC · Sprint 8", built: true },
    reads: "CSTMST, ORDHDRL1",
  },
  {
    screen: "Items",
    greenScreen: { label: "ITEMPGM · Sprint 3", built: true },
    writes: { label: "ITEMSVC_API → ITEMSVC · Sprint 8", built: true },
    reads: "ITMMST, ORDDTLL2",
  },
  {
    screen: "Orders",
    greenScreen: { label: "ORDPGM · Sprints 4–6", built: true },
    writes: { label: "ORDSVC_API → ORDSVC · Sprint 8", built: true },
    reads: "ORDSUMV, ORDHDR, ORDDTLF, CSTMST, NXTORDNO",
  },
  {
    screen: "Audit log",
    greenScreen: { label: "journal view ORDAUDJV · Sprint 7", built: true },
    writes: { label: "none (read-only screen)", built: true },
    reads: "ORDAUDJV (QSYS2.DISPLAY_JOURNAL)",
  },
  {
    screen: "Messages",
    greenScreen: { label: "COMMSGF · Sprint 1", built: true },
    writes: { label: "none", built: true },
    reads: "QSYS2.MESSAGE_FILE_DATA",
  },
]

/** The modernization story inside the app (handoff §6.5 System). */
export function SystemPage() {
  const { data: health, error } = useHealth()

  return (
    <Page title="System" description="How this web app sits on top of the IBM i backend.">
      <section className="rounded-lg border bg-card p-5 sm:p-6">
        <h2 className="mb-4 text-sm font-semibold">Architecture</h2>
        <ArchitectureDiagram />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Principle
          icon={BookOpenCheck}
          title="Reads may use SQL"
          body="Lists and detail pages SELECT from the files and views directly. Reads carry no business rules, so this is safe and fast."
        />
        <Principle
          icon={PenLine}
          title="Every write goes through RPG"
          body="Add, change and delete call the same RPG service programs the green screen uses. They validate, write, move stock and COMMIT or ROLLBACK. The web never re-implements a rule."
          accent
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div className="rounded-lg border bg-card p-5">
          <h2 className="mb-4 text-sm font-semibold">Connection</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
            <Row label="Backend">
              <Pill tone="success">FastAPI</Pill>
            </Row>
            <Row label="API address">
              <span className="num text-xs">{config.apiBase}</span>
            </Row>
            <Row label="Route">
              {health?.connection === "direct-plain" ? (
                <Pill tone="warning">Direct · not encrypted</Pill>
              ) : health?.connection === "direct-tls" ? (
                <Pill tone="success">Direct · TLS</Pill>
              ) : (
                <Pill tone="success">SSH tunnel</Pill>
              )}
            </Row>
            <Row label="Reachable">
              {error ? (
                <Pill tone="danger">API offline</Pill>
              ) : health ? (
                <Pill tone={health.tunnel === "ok" ? "success" : "danger"}>
                  {health.tunnel === "ok" ? "Up" : "Down"}
                </Pill>
              ) : (
                "…"
              )}
            </Row>
            <Row label="System">
              <span className="num">{health?.system ?? "–"}</span>
            </Row>
            <Row label="Library">
              <span className="num">{health?.library ?? "–"}</span>
            </Row>
            <Row label="Round trip">
              <span className="num">{health?.latencyMs != null ? `${health.latencyMs} ms` : "–"}</span>
            </Row>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Checked every 15 s. Host names and credentials are never sent to the browser.
          </p>
        </div>

        <div className="overflow-hidden rounded-lg border bg-card">
          <h2 className="px-5 pt-5 pb-3 text-sm font-semibold">IBM i objects behind each screen</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr className="border-y">
                  <th className="h-9 pl-5 text-left font-medium">Screen</th>
                  <th className="h-9 text-left font-medium">Green screen</th>
                  <th className="h-9 text-left font-medium">Web writes via</th>
                  <th className="h-9 pr-5 text-left font-medium">Reads</th>
                </tr>
              </thead>
              <tbody>
                {OBJECTS.map((o) => (
                  <tr key={o.screen} className="border-b align-top last:border-0">
                    <td className="py-3 pl-5 font-medium">{o.screen}</td>
                    <td className="py-3 pr-3">
                      <StageCell stage={o.greenScreen} />
                    </td>
                    <td className="py-3 pr-3">
                      <StageCell stage={o.writes} />
                    </td>
                    <td className="py-3 pr-5 num text-xs text-muted-foreground">{o.reads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-5 py-3 text-xs text-muted-foreground">
            <Pill tone="success">Built</Pill> exists in ARNAV27122 on PUB400 today
          </p>
        </div>
      </section>
    </Page>
  )
}

function Principle({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof PenLine
  title: string
  body: string
  accent?: boolean
}) {
  return (
    <div
      className={
        accent ? "rounded-xl border border-primary/30 bg-brand-soft p-5" : "rounded-lg border bg-card p-5"
      }
    >
      <div className="flex items-center gap-2.5">
        <Icon aria-hidden className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{body}</p>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  )
}

function StageCell({ stage }: { stage: Stage }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Pill tone={stage.built ? "success" : "neutral"}>{stage.built ? "Built" : "Planned"}</Pill>
      <span className="text-xs">{stage.label}</span>
    </span>
  )
}
