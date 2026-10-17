import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "../client"
import type { ApiError } from "../errors"
import { qk } from "../query-keys"
import type { AuditEntry, AuditQuery, DashboardData, Page } from "../types"

/** One call for the whole dashboard: counts, revenue, 30 days, top items, low stock, recent rows (§5.4). */
export function useDashboard() {
  return useQuery<DashboardData, ApiError>({
    queryKey: qk.dashboard,
    queryFn: ({ signal }) => api<DashboardData>("/dashboard", { signal }),
  })
}

/** ORDAUD, newest first. `live` polls every 10 s for the demo (§6.5). */
export function useAuditLog(query: AuditQuery, live: boolean) {
  return useQuery<Page<AuditEntry>, ApiError>({
    queryKey: qk.auditList(query),
    queryFn: ({ signal }) => api<Page<AuditEntry>>("/audit", { query: { ...query }, signal }),
    placeholderData: keepPreviousData,
    refetchInterval: live ? 10_000 : false,
  })
}
