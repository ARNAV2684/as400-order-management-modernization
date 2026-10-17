/** Props to spread on the input inside a Field. */
export function fieldAria(id: string, error: string | undefined, hasHint = false) {
  return {
    id,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error || hasHint ? `${id}-msg` : undefined,
  } as const
}
