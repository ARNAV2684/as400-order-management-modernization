import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { api } from "@/api/client"
import type { ApiError } from "@/api/errors"
import type { OrderDraft, OrderValidateResult } from "@/api/types"
import { useDebouncedValue } from "@/lib/use-debounced-value"

const DEBOUNCE_MS = 400 // handoff §6.5

/**
 * ORDSVC 'VA' / 'VE' after every change, 400 ms after the user stops typing.
 *
 * It's a POST, but it writes nothing, so it's treated as a query keyed by the draft itself:
 * an unchanged draft is never checked twice, a superseded check is cancelled, and the previous
 * answer stays on screen (marked stale) while the next one runs.
 */
export function useLiveValidation(draft: OrderDraft, enabled: boolean) {
  const key = JSON.stringify(draft)
  const debouncedKey = useDebouncedValue(key, DEBOUNCE_MS)

  const query = useQuery<OrderValidateResult, ApiError>({
    queryKey: ["orders", "validate", debouncedKey],
    queryFn: ({ signal }) =>
      api<OrderValidateResult>("/orders/validate", {
        method: "POST",
        body: JSON.parse(debouncedKey) as OrderDraft,
        signal,
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  })

  // "current" = this answer is for exactly what is on screen now (Save depends on it, §6.5).
  const current = Boolean(query.data) && !query.isPlaceholderData && debouncedKey === key && !query.isFetching
  const checking = enabled && (debouncedKey !== key || query.isFetching)

  return { result: query.data, current, checking, error: query.error }
}
