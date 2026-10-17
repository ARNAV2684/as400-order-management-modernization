import { useCallback, useRef, useState } from "react"
import type { FieldValues, Path, UseFormReturn } from "react-hook-form"

import { ApiError } from "@/api/errors"
import type { ApiErrorItem, ValidateResult } from "@/api/types"

const SERVER = "server"

/**
 * Runs the RPG checks (/validate) and puts each COM message on its field.
 * The form's own schema only checks shape; every business rule comes back from here.
 * Fields the user hasn't reached yet stay quiet until they submit.
 */
export function useServerValidation<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: readonly Path<T>[],
  /** Returns null when the values aren't even shaped right (no point asking the RPG). */
  run: (values: T) => Promise<ValidateResult> | null,
) {
  const seq = useRef(0)
  const [checking, setChecking] = useState(false)

  /** Puts server messages on fields; returns the ones that have no field (for the summary). */
  const apply = useCallback(
    (errors: ApiErrorItem[], showAll: boolean): ApiErrorItem[] => {
      for (const f of fields) {
        if (form.getFieldState(f).error?.type === SERVER) form.clearErrors(f)
      }
      const general: ApiErrorItem[] = []
      for (const e of errors) {
        const f = fields.find((x) => x === e.field)
        if (!f) general.push(e)
        // getFieldState reads live state; formState.touchedFields only updates if read during render
        else if (showAll || form.getFieldState(f).isTouched)
          form.setError(f, { type: SERVER, message: e.text }, { shouldFocus: false })
      }
      return general
    },
    [form, fields],
  )

  const validateNow = useCallback(async () => {
    const request = run(form.getValues())
    if (!request) return
    const mine = ++seq.current
    setChecking(true)
    try {
      const result = await request
      if (mine === seq.current) apply(result.errors, false)
    } catch (e) {
      // Backend down shows in the banner; a failed check must not block typing.
      if (!(e instanceof ApiError)) throw e
    } finally {
      if (mine === seq.current) setChecking(false)
    }
  }, [form, run, apply])

  return { validateNow, checking, applyErrors: apply }
}
