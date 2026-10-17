import { z } from "zod"

import type { Customer, CustomerInput } from "@/api/types"

/*
 * Shape checks only (digits, lengths from CSTMST). Business rules — number > 0, name not blank,
 * duplicates, status A/I — are the RPG's job and come back from /validate as COM messages.
 */
export const customerSchema = z.object({
  custNo: z
    .string()
    .trim()
    .regex(/^\d{1,7}$/, "Enter a number, up to 7 digits."),
  name: z.string().max(40, "Up to 40 characters."),
  address: z.string().max(50, "Up to 50 characters."),
  city: z.string().max(30, "Up to 30 characters."),
  state: z.string().max(20, "Up to 20 characters."),
  status: z.enum(["A", "I"]),
})

export type CustomerFormValues = z.infer<typeof customerSchema>

export const CUSTOMER_FIELDS = ["custNo", "name", "address", "city", "state", "status"] as const

export const emptyCustomer: CustomerFormValues = {
  custNo: "",
  name: "",
  address: "",
  city: "",
  state: "",
  status: "A",
}

export const toFormValues = (c: Customer): CustomerFormValues => ({ ...c, custNo: String(c.custNo) })

/** CUSTDSPF has no CHECK(LC), so the green screen stores text in capitals; the web does the same. */
export const toInput = (v: CustomerFormValues): CustomerInput => ({
  custNo: Number(v.custNo),
  name: v.name.toUpperCase().trimEnd(),
  address: v.address.toUpperCase().trimEnd(),
  city: v.city.toUpperCase().trimEnd(),
  state: v.state.toUpperCase().trimEnd(),
  status: v.status,
})
