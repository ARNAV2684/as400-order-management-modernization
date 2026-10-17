import { useCallback, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { ApiError } from "@/api/errors"
import { useCreateCustomer, useUpdateCustomer, useValidateCustomer } from "@/api/hooks/customers"
import type { Customer } from "@/api/types"
import { ErrorBanner } from "@/components/data/ErrorState"
import { Field } from "@/components/forms/Field"
import { fieldAria } from "@/components/forms/field-aria"
import { FormSheet } from "@/components/forms/FormSheet"
import { SaveButton } from "@/components/forms/SaveButton"
import { saveErrorTitle } from "@/components/forms/save-error"
import { StatusField } from "@/components/forms/StatusField"
import { useServerValidation } from "@/components/forms/use-server-validation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useHotkey } from "@/lib/hotkeys"

import {
  CUSTOMER_FIELDS,
  customerSchema,
  emptyCustomer,
  toFormValues,
  toInput,
  type CustomerFormValues,
} from "./customer-form"

const FORM_ID = "customer-form"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present = edit that customer; absent = add a new one. */
  customer?: Customer
  onSaved: (custNo: number, message: string) => void
}

/** Add / edit a customer. Replaces CUSTPGM's detail screen in ADD and EDIT mode (F10 = Save). */
export function CustomerFormSheet({ open, onOpenChange, customer, onSaved }: Props) {
  const mode = customer ? "edit" : "add"
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: customer ? toFormValues(customer) : emptyCustomer,
    mode: "onTouched",
  })
  const [saveError, setSaveError] = useState<ApiError | null>(null)

  const create = useCreateCustomer()
  const update = useUpdateCustomer()
  const validate = useValidateCustomer()
  const saving = create.isPending || update.isPending

  const setOpen = (next: boolean) => {
    if (!next) setSaveError(null)
    onOpenChange(next)
  }

  // Fresh values every time the panel opens (it stays mounted so the close animation can play).
  useEffect(() => {
    if (!open) return
    form.reset(customer ? toFormValues(customer) : emptyCustomer)
  }, [open, customer, form])

  const runCheck = useCallback(
    (values: CustomerFormValues) => {
      const parsed = customerSchema.safeParse(values)
      return parsed.success ? validate.mutateAsync({ body: toInput(parsed.data), mode }) : null
    },
    [validate, mode],
  )
  const { validateNow, checking, applyErrors } = useServerValidation(form, CUSTOMER_FIELDS, runCheck)

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null)
    try {
      const body = toInput(values)
      const res = await (mode === "add" ? create : update).mutateAsync(body)
      onSaved(body.custNo, res.message)
      setOpen(false)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      const general = applyErrors(e.errors, true)
      // Field messages are already on their fields; the banner lists only the rest.
      setSaveError(new ApiError(e.status, general, e.traceId))
    }
  })

  // Alt+S = F10 (save). requestSubmit runs the same path as clicking Save, validation included.
  useHotkey("alt+s", () => document.querySelector<HTMLFormElement>(`#${FORM_ID}`)?.requestSubmit(), {
    enabled: open && !saving,
  })

  const err = (f: keyof CustomerFormValues) => form.formState.errors[f]?.message

  return (
    <FormSheet
      open={open}
      onOpenChange={setOpen}
      dirty={form.formState.isDirty}
      busy={saving}
      title={mode === "add" ? "New customer" : `Edit customer ${customer?.custNo}`}
      description={
        mode === "add"
          ? "The RPG checks each field when you leave it."
          : "The customer number can't change. The RPG checks each field when you leave it."
      }
      footer={
        <>
          {checking && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Checking with CUSTSVC…
            </span>
          )}
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <SaveButton form={FORM_ID} saving={saving} />
        </>
      }
    >
      <form
        id={FORM_ID}
        noValidate
        onSubmit={onSubmit}
        onBlur={() => void validateNow()}
        className="grid gap-5"
      >
        {saveError && <ErrorBanner error={saveError} title={saveErrorTitle(saveError)} />}

        <Field
          id="custNo"
          label="Customer number"
          error={err("custNo")}
          aside={
            mode === "edit" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> Locked
              </span>
            )
          }
        >
          <Input
            {...fieldAria("custNo", err("custNo"))}
            {...form.register("custNo")}
            inputMode="numeric"
            maxLength={7}
            readOnly={mode === "edit"}
            autoFocus={mode === "add"}
            className="h-9 w-36 num read-only:bg-muted read-only:text-muted-foreground"
          />
        </Field>

        <Field id="name" label="Name" error={err("name")}>
          <Input
            {...fieldAria("name", err("name"))}
            {...form.register("name")}
            maxLength={40}
            autoFocus={mode === "edit"}
            className="h-9 uppercase"
          />
        </Field>

        <Field id="address" label="Address" error={err("address")}>
          <Input
            {...fieldAria("address", err("address"))}
            {...form.register("address")}
            maxLength={50}
            className="h-9 uppercase"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="city" label="City" error={err("city")}>
            <Input
              {...fieldAria("city", err("city"))}
              {...form.register("city")}
              maxLength={30}
              className="h-9 uppercase"
            />
          </Field>
          <Field id="state" label="State" error={err("state")}>
            <Input
              {...fieldAria("state", err("state"))}
              {...form.register("state")}
              maxLength={20}
              className="h-9 uppercase"
            />
          </Field>
        </div>

        <Field
          id="status"
          label="Status"
          error={err("status")}
          hint="Inactive customers can't receive new orders."
        >
          <Controller
            control={form.control}
            name="status"
            render={({ field }) => (
              <StatusField
                id="status"
                value={field.value}
                onChange={(v) => field.onChange(v)}
                onBlur={field.onBlur}
                invalid={Boolean(err("status"))}
              />
            )}
          />
        </Field>
      </form>
    </FormSheet>
  )
}
