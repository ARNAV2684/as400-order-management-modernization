import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"

interface SegmentedFilterProps<V extends string> {
  label: string
  value: V
  options: { value: V; label: string }[]
  onChange: (value: V) => void
  className?: string
}

/** Pick-one filter (All / Active / Inactive). Clicking the selected option again keeps it selected. */
export function SegmentedFilter<V extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedFilterProps<V>) {
  return (
    <ToggleGroup
      type="single"
      aria-label={label}
      value={value}
      onValueChange={(v) => v && onChange(v as V)}
      className={cn("h-9 rounded-lg border bg-card p-0.5", className)}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className="h-full rounded-md px-3 text-xs font-medium text-muted-foreground data-[state=on]:bg-brand-soft data-[state=on]:text-primary"
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
