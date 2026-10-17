import type { Status } from "@/api/types"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

/** STATUS A / I as a two-way switch (the 5250 field takes a typed letter instead). */
export function StatusField({
  id,
  value,
  onChange,
  onBlur,
  invalid,
}: {
  id: string
  value: Status
  onChange: (v: Status) => void
  onBlur: () => void
  invalid?: boolean
}) {
  return (
    <ToggleGroup
      id={id}
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as Status)}
      onBlur={onBlur}
      aria-invalid={invalid || undefined}
      className={cn("h-9 w-fit rounded-lg border bg-card p-0.5", invalid && "border-danger")}
    >
      <ToggleGroupItem
        value="A"
        className="h-full rounded-md px-3 text-xs font-medium text-muted-foreground data-[state=on]:bg-success-soft data-[state=on]:text-success"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current" />
        Active
      </ToggleGroupItem>
      <ToggleGroupItem
        value="I"
        className="h-full rounded-md px-3 text-xs font-medium text-muted-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground"
      >
        <span aria-hidden className="size-1.5 rounded-full bg-current opacity-60" />
        Inactive
      </ToggleGroupItem>
    </ToggleGroup>
  )
}
