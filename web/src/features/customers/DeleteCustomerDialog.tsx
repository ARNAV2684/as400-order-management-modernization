import { useDeleteCustomer, useUpdateCustomer } from "@/api/hooks/customers"
import type { Customer } from "@/api/types"
import { DeleteDialog } from "@/components/data/DeleteDialog"

interface Props {
  customer: Customer | null
  onOpenChange: (open: boolean) => void
  onDone: (message: string, deleted: boolean) => void
}

/** CUSTSVC 'D'. Blocked with COM0009 while the customer has orders (CUSTPGM's SETLL on ORDHDRL1, plus the FK). */
export function DeleteCustomerDialog({ customer, onOpenChange, onDone }: Props) {
  const del = useDeleteCustomer()
  const update = useUpdateCustomer()

  return (
    <DeleteDialog
      open={customer !== null}
      onOpenChange={onOpenChange}
      noun="customer"
      recordLabel={customer ? `${customer.custNo} · ${customer.name}` : ""}
      blockedIds={["COM0009"]}
      blockedHelp="Its order history has to stay. Setting it to Inactive keeps the history and stops new orders for it."
      onDelete={() => del.mutateAsync(customer!.custNo)}
      onSetInactive={
        customer && customer.status === "A"
          ? () => update.mutateAsync({ ...customer, status: "I" })
          : undefined
      }
      onDone={onDone}
    />
  )
}
