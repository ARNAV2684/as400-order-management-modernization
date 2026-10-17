import { useCallback, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Lock } from "lucide-react"
import { Controller, useForm } from "react-hook-form"

import { ApiError } from "@/api/errors"
import { useCreateItem, useUpdateItem, useValidateItem } from "@/api/hooks/items"
import type { Item } from "@/api/types"
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

import { emptyItem, ITEM_FIELDS, itemSchema, toFormValues, toInput, type ItemFormValues } from "./item-form"

const FORM_ID = "item-form"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  item?: Item
  onSaved: (itemNo: number, message: string) => void
}

/** Add / edit an item. Replaces ITEMPGM's detail screen in ADD and EDIT mode (F10 = Save). */
export function ItemFormSheet({ open, onOpenChange, item, onSaved }: Props) {
  const mode = item ? "edit" : "add"
  const form = useForm<ItemFormValues>({
    resolver: zodResolver(itemSchema),
    defaultValues: item ? toFormValues(item) : emptyItem,
    mode: "onTouched",
  })
  const [saveError, setSaveError] = useState<ApiError | null>(null)

  const create = useCreateItem()
  const update = useUpdateItem()
  const validate = useValidateItem()
  const saving = create.isPending || update.isPending

  const setOpen = (next: boolean) => {
    if (!next) setSaveError(null)
    onOpenChange(next)
  }

  // Fresh values every time the panel opens (it stays mounted so the close animation can play).
  useEffect(() => {
    if (!open) return
    form.reset(item ? toFormValues(item) : emptyItem)
  }, [open, item, form])

  const runCheck = useCallback(
    (values: ItemFormValues) => {
      const parsed = itemSchema.safeParse(values)
      return parsed.success ? validate.mutateAsync({ body: toInput(parsed.data), mode }) : null
    },
    [validate, mode],
  )
  const { validateNow, checking, applyErrors } = useServerValidation(form, ITEM_FIELDS, runCheck)

  const onSubmit = form.handleSubmit(async (values) => {
    setSaveError(null)
    try {
      const body = toInput(values)
      const res = await (mode === "add" ? create : update).mutateAsync(body)
      onSaved(body.itemNo, res.message)
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

  const err = (f: keyof ItemFormValues) => form.formState.errors[f]?.message

  return (
    <FormSheet
      open={open}
      onOpenChange={setOpen}
      dirty={form.formState.isDirty}
      busy={saving}
      title={mode === "add" ? "New item" : `Edit item ${item?.itemNo}`}
      description={
        mode === "add"
          ? "The RPG checks each field when you leave it."
          : "The item number can't change. Price changes are logged by the ITMPRCH trigger."
      }
      footer={
        <>
          {checking && (
            <span className="mr-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> Checking with ITEMSVC…
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
          id="itemNo"
          label="Item number"
          error={err("itemNo")}
          aside={
            mode === "edit" && (
              <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                <Lock className="size-3" /> Locked
              </span>
            )
          }
        >
          <Input
            {...fieldAria("itemNo", err("itemNo"))}
            {...form.register("itemNo")}
            inputMode="numeric"
            maxLength={7}
            readOnly={mode === "edit"}
            autoFocus={mode === "add"}
            className="h-9 w-36 num read-only:bg-muted read-only:text-muted-foreground"
          />
        </Field>

        <Field id="description" label="Description" error={err("description")}>
          <Input
            {...fieldAria("description", err("description"))}
            {...form.register("description")}
            maxLength={50}
            autoFocus={mode === "edit"}
            className="h-9 uppercase"
          />
        </Field>

        <Field id="category" label="Category" error={err("category")}>
          <Input
            {...fieldAria("category", err("category"))}
            {...form.register("category")}
            maxLength={20}
            className="h-9 uppercase"
          />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="unitPrice" label="Unit price" error={err("unitPrice")}>
            <div className="relative">
              <span
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground"
              >
                ₹
              </span>
              <Input
                {...fieldAria("unitPrice", err("unitPrice"))}
                {...form.register("unitPrice")}
                inputMode="decimal"
                maxLength={11}
                placeholder="0.00"
                className="h-9 pl-6 text-right num"
              />
            </div>
          </Field>
          <Field id="stockQty" label="Stock on hand" error={err("stockQty")}>
            <Input
              {...fieldAria("stockQty", err("stockQty"))}
              {...form.register("stockQty")}
              inputMode="numeric"
              maxLength={10}
              className="h-9 text-right num"
            />
          </Field>
        </div>

        <Field
          id="status"
          label="Status"
          error={err("status")}
          hint="Inactive items can't be added to new orders."
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
