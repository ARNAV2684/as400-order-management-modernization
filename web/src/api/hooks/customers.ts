import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "../client"
import type { ApiError } from "../errors"
import { qk } from "../query-keys"
import type {
  Customer,
  CustomerDetail,
  CustomerInput,
  CustomerQuery,
  Page,
  SaveResult,
  ValidateResult,
} from "../types"

/** `enabled: false` = don't fetch yet (e.g. a search box that is still empty). */
export function useCustomers(query: CustomerQuery, enabled = true) {
  return useQuery<Page<Customer>, ApiError>({
    queryKey: qk.customers.list(query),
    queryFn: ({ signal }) => api<Page<Customer>>("/customers", { query: { ...query }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useCustomer(custNo: number) {
  return useQuery<CustomerDetail, ApiError>({
    queryKey: qk.customers.detail(custNo),
    queryFn: ({ signal }) => api<CustomerDetail>(`/customers/${custNo}`, { signal }),
    enabled: custNo > 0,
  })
}

/** Customer names also show on orders and the dashboard, so a customer save refreshes those too. */
function useInvalidateCustomers() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.customers.all }),
      qc.invalidateQueries({ queryKey: qk.orders.all }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
    ])
}

export function useCreateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation<SaveResult, ApiError, CustomerInput>({
    mutationFn: (body) => api<SaveResult>("/customers", { method: "POST", body }),
    onSuccess: invalidate,
  })
}

export function useUpdateCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation<SaveResult, ApiError, CustomerInput>({
    mutationFn: (body) => api<SaveResult>(`/customers/${body.custNo}`, { method: "PUT", body }),
    onSuccess: invalidate,
  })
}

export function useDeleteCustomer() {
  const invalidate = useInvalidateCustomers()
  return useMutation<SaveResult, ApiError, number>({
    mutationFn: (custNo) => api<SaveResult>(`/customers/${custNo}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

/** CUSTSVC 'V': runs the RPG checks without writing. `mode` tells it whether the number must be new. */
export function useValidateCustomer() {
  return useMutation<ValidateResult, ApiError, { body: CustomerInput; mode: "add" | "edit" }>({
    mutationFn: ({ body, mode }) =>
      api<ValidateResult>("/customers/validate", { method: "POST", query: { mode }, body }),
  })
}
