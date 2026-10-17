import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "../client"
import type { ApiError } from "../errors"
import { qk } from "../query-keys"
import type {
  AuditEntry,
  CreateOrderResult,
  OrderDetail,
  OrderDraft,
  OrderQuery,
  OrderSummary,
  OrderValidateResult,
  Page,
  SaveResult,
} from "../types"

export function useOrders(query: OrderQuery) {
  return useQuery<Page<OrderSummary>, ApiError>({
    queryKey: qk.orders.list(query),
    queryFn: ({ signal }) => api<Page<OrderSummary>>("/orders", { query: { ...query }, signal }),
    placeholderData: keepPreviousData,
  })
}

export function useOrder(ordNo: number) {
  return useQuery<OrderDetail, ApiError>({
    queryKey: qk.orders.detail(ordNo),
    queryFn: ({ signal }) => api<OrderDetail>(`/orders/${ordNo}`, { signal }),
    enabled: ordNo > 0,
  })
}

export function useOrderAudit(ordNo: number) {
  return useQuery<AuditEntry[], ApiError>({
    queryKey: qk.orders.audit(ordNo),
    queryFn: ({ signal }) => api<AuditEntry[]>(`/orders/${ordNo}/audit`, { signal }),
    enabled: ordNo > 0,
  })
}

/**
 * An order save or delete moves stock (items), changes a customer's order count, writes an audit row
 * and changes the dashboard, so all of those refresh.
 */
export function useInvalidateAfterOrderChange() {
  const qc = useQueryClient()
  return () =>
    Promise.all(
      [qk.orders.all, qk.items.all, qk.customers.all, qk.dashboard, qk.audit].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    )
}

/** ORDSVC 'DL': deletes header + lines, returns their stock, writes the D audit row (all or nothing). */
export function useDeleteOrder() {
  const invalidate = useInvalidateAfterOrderChange()
  const qc = useQueryClient()
  return useMutation<SaveResult, ApiError, number>({
    mutationFn: (ordNo) => api<SaveResult>(`/orders/${ordNo}`, { method: "DELETE" }),
    onSuccess: async (_res, ordNo) => {
      // The detail is gone; drop it instead of refetching into a 404.
      qc.removeQueries({ queryKey: qk.orders.detail(ordNo) })
      await invalidate()
    },
  })
}

/** ORDSVC 'VA' / 'VE': runs every RPG check, fills description / price / amount and the total. Writes nothing. */
export function useValidateOrder() {
  return useMutation<OrderValidateResult, ApiError, { draft: OrderDraft; signal?: AbortSignal }>({
    mutationFn: ({ draft, signal }) =>
      api<OrderValidateResult>("/orders/validate", { method: "POST", body: draft, signal }),
  })
}

/** ORDSVC 'SA': next number from NXTORDNO, header + lines + stock + audit A, one commit → COM0025. */
export function useCreateOrder() {
  const invalidate = useInvalidateAfterOrderChange()
  return useMutation<CreateOrderResult, ApiError, OrderDraft>({
    mutationFn: (draft) => api<CreateOrderResult>("/orders", { method: "POST", body: draft }),
    onSuccess: () => invalidate(),
  })
}

/** ORDSVC 'SE': checksum check, then changed / deleted / new lines, stock by net change, audit U → COM0027. */
export function useUpdateOrder() {
  const invalidate = useInvalidateAfterOrderChange()
  return useMutation<SaveResult, ApiError, OrderDraft>({
    mutationFn: (draft) => api<SaveResult>(`/orders/${draft.ordNo}`, { method: "PUT", body: draft }),
    onSuccess: () => invalidate(),
  })
}
