import { useDeleteItem, useUpdateItem } from "@/api/hooks/items"
import type { Item } from "@/api/types"
import { DeleteDialog } from "@/components/data/DeleteDialog"

interface Props {
  item: Item | null
  onOpenChange: (open: boolean) => void
  onDone: (message: string, deleted: boolean) => void
}

/** ITEMSVC 'D'. Blocked with COM0017 while any order line uses the item (ITEMPGM's SETLL on ORDDTLL2). */
export function DeleteItemDialog({ item, onOpenChange, onDone }: Props) {
  const del = useDeleteItem()
  const update = useUpdateItem()

  return (
    <DeleteDialog
      open={item !== null}
      onOpenChange={onOpenChange}
      noun="item"
      recordLabel={item ? `${item.itemNo} · ${item.description}` : ""}
      blockedIds={["COM0017"]}
      blockedHelp="Existing orders still point at it. Setting it to Inactive keeps those orders and stops it being added to new ones."
      onDelete={() => del.mutateAsync(item!.itemNo)}
      onSetInactive={
        item && item.status === "A" ? () => update.mutateAsync({ ...item, status: "I" }) : undefined
      }
      onDone={onDone}
    />
  )
}
