import { useQueryClient } from "@tanstack/react-query"
import { RefreshCw, Unplug } from "lucide-react"

import { useBackendStatus, useHealth } from "@/api/hooks/system"
import { qk } from "@/api/query-keys"
import { Button } from "@/components/ui/button"

/** Full-width warning when IBM i or the API is unreachable (§6.4). Saves are disabled while it shows. */
export function BackendBanner() {
  const status = useBackendStatus()
  const direct = (useHealth().data?.connection ?? "tunnel") !== "tunnel"
  const qc = useQueryClient()
  if (status !== "tunnel-down" && status !== "api-down") return null

  return (
    <div
      role="alert"
      className="flex animate-in flex-wrap items-center gap-x-4 gap-y-2 border-b border-danger/25 bg-danger-soft px-4 py-2.5 text-sm text-danger duration-300 fade-in slide-in-from-top-2 sm:px-6"
    >
      <Unplug aria-hidden className="size-4 shrink-0" />
      <p className="min-w-0 flex-1">
        {status === "tunnel-down" && direct ? (
          <>
            <strong className="font-semibold">Can't reach PUB400.</strong> The API connects to it directly;
            check the internet connection or PUB400's status. Saving is turned off until it's back.
          </>
        ) : status === "tunnel-down" ? (
          <>
            <strong className="font-semibold">Can't reach IBM i.</strong> Start the SSH tunnel with{" "}
            <code className="rounded bg-danger/10 px-1 py-0.5 num text-xs">sh tools/tunnel_pub400.sh</code>.
            Saving is turned off until it's back.
          </>
        ) : (
          <>
            <strong className="font-semibold">The COM API isn't answering.</strong> Start it on
            127.0.0.1:8000. Saving is turned off until it's back.
          </>
        )}
      </p>
      <Button
        size="sm"
        variant="outline"
        className="border-danger/30 bg-transparent text-danger hover:bg-danger/10 hover:text-danger"
        onClick={() => void qc.invalidateQueries({ queryKey: qk.health })}
      >
        <RefreshCw className="size-3.5" />
        Check again
      </Button>
    </div>
  )
}
