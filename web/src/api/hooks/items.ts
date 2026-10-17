import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "../client"
import type { ApiError } from "../errors"
import { qk } from "../query-keys"
import type { Item, ItemDetail, ItemInput, ItemQuery, Page, SaveResult, ValidateResult } from "../types"

/** `enabled: false` = don't fetch yet (e.g. a search box that is still empty). */
export function useItems(query: ItemQuery, enabled = true) {
  return useQuery<Page<Item>, ApiError>({
    queryKey: qk.items.list(query),
    queryFn: ({ signal }) => api<Page<Item>>("/items", { query: { ...query }, signal }),
    placeholderData: keepPreviousData,
    enabled,
  })
}

export function useItem(itemNo: number) {
  return useQuery<ItemDetail, ApiError>({
    queryKey: qk.items.detail(itemNo),
    queryFn: ({ signal }) => api<ItemDetail>(`/items/${itemNo}`, { signal }),
    enabled: itemNo > 0,
  })
}

/** Item price and stock feed the order editor and the dashboard's low-stock list. */
function useInvalidateItems() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.items.all }),
      qc.invalidateQueries({ queryKey: qk.orders.all }),
      qc.invalidateQueries({ queryKey: qk.dashboard }),
    ])
}

export function useCreateItem() {
  const invalidate = useInvalidateItems()
  return useMutation<SaveResult, ApiError, ItemInput>({
    mutationFn: (body) => api<SaveResult>("/items", { method: "POST", body }),
    onSuccess: invalidate,
  })
}

export function useUpdateItem() {
  const invalidate = useInvalidateItems()
  return useMutation<SaveResult, ApiError, ItemInput>({
    mutationFn: (body) => api<SaveResult>(`/items/${body.itemNo}`, { method: "PUT", body }),
    onSuccess: invalidate,
  })
}

export function useDeleteItem() {
  const invalidate = useInvalidateItems()
  return useMutation<SaveResult, ApiError, number>({
    mutationFn: (itemNo) => api<SaveResult>(`/items/${itemNo}`, { method: "DELETE" }),
    onSuccess: invalidate,
  })
}

/** ITEMSVC 'V': RPG checks without writing. */
export function useValidateItem() {
  return useMutation<ValidateResult, ApiError, { body: ItemInput; mode: "add" | "edit" }>({
    mutationFn: ({ body, mode }) =>
      api<ValidateResult>("/items/validate", { method: "POST", query: { mode }, body }),
  })
}
