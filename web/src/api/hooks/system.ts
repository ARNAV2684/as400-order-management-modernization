import { useQuery } from "@tanstack/react-query"

import { api } from "../client"
import type { ApiError } from "../errors"
import { qk } from "../query-keys"
import type { ComMessage, Health } from "../types"

const HEALTH_POLL_MS = 15_000

export function useHealth() {
  return useQuery<Health, ApiError>({
    queryKey: qk.health,
    queryFn: ({ signal }) => api<Health>("/health", { signal }),
    refetchInterval: HEALTH_POLL_MS,
    staleTime: 0,
    retry: false,
  })
}

export type BackendStatus = "checking" | "ok" | "tunnel-down" | "api-down"

/** One answer for "can we talk to IBM i right now?", used by the pill, the banner and every save button. */
export function useBackendStatus(): BackendStatus {
  const { data, error, isPending } = useHealth()
  if (error) return "api-down"
  if (isPending) return "checking"
  return data.tunnel === "ok" && data.db === "ok" ? "ok" : "tunnel-down"
}

export function useMessages() {
  return useQuery<ComMessage[], ApiError>({
    queryKey: qk.messages,
    queryFn: ({ signal }) => api<ComMessage[]>("/meta/messages", { signal }),
    staleTime: Infinity,
  })
}
