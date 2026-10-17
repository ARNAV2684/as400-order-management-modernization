import { z } from "zod"

import type { Item, ItemInput } from "@/api/types"

/*
 * Shape checks only, from ITMMST (ITEMNO 7P0, UNITPRICE 9P2, STOCKQTY 9P0). A minus sign is allowed
 * through on purpose: "price / stock cannot be negative" is the RPG's rule (COM0015 / COM0016).
 */
export const itemSchema = z.object({
  itemNo: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Enter a number, up to 7 digits."),
  description: z.string().max(50, "Up to 50 characters."),
  category: z.string().max(20, "Up to 20 characters."),
  unitPrice: z
    .string()
    .trim()
    .regex(
      /^-?\d{1,7}(\.\d{1,2})?$/,
      "Enter an amount like 1250 or 1250.50 (up to 7 digits before the point).",
    ),
  stockQty: z
    .string()
    .trim()
    .regex(/^-?\d{1,9}$/, "Enter a whole number, up to 9 digits."),
  status: z.enum(["A", "I"]),
})

export type ItemFormValues = z.infer<typeof itemSchema>

export const ITEM_FIELDS = ["itemNo", "description", "category", "unitPrice", "stockQty", "status"] as const

export const emptyItem: ItemFormValues = {
  itemNo: "",
  description: "",
  category: "",
  unitPrice: "",
  stockQty: "0",
  status: "A",
}

export const toFormValues = (i: Item): ItemFormValues => ({
  ...i,
  itemNo: String(i.itemNo),
  stockQty: String(i.stockQty),
})

/** Money stays a string: "1250.5" → "1250.50". ITEMDSPF has no CHECK(LC), so text is stored in capitals. */
export const toInput = (v: ItemFormValues): ItemInput => {
  const [whole = "0", frac = ""] = v.unitPrice.trim().split(".")
  return {
    itemNo: Number(v.itemNo),
    description: v.description.toUpperCase().trimEnd(),
    category: v.category.toUpperCase().trimEnd(),
    unitPrice: `${whole}.${(frac + "00").slice(0, 2)}`,
    stockQty: Number(v.stockQty),
    status: v.status,
  }
}
