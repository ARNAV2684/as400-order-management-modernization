import { useState } from "react"
import { Check, ChevronsUpDown, Loader2 } from "lucide-react"

import { useItem, useItems } from "@/api/hooks/items"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatCount, formatINR } from "@/lib/money"
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { cn } from "@/lib/utils"

import { LOW_STOCK, Pill } from "./StatusBadge"

interface ItemComboboxProps {
  id?: string
  value: number | null
  onChange: (itemNo: number) => void
  invalid?: boolean
  /** Shown read-only in the list so the user sees why they can't pick it (COM0018). */
  disableInactive?: boolean
  className?: string
  "aria-label"?: string
}

/** Item picker for order lines: number, description, price and stock available (handoff §6.5). */
export function ItemCombobox({
  id,
  value,
  onChange,
  invalid,
  disableInactive,
  className,
  ...rest
}: ItemComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
  const { data, isFetching } = useItems({ q, size: 20 }, open)
  const selected = useItem(value ?? 0).data

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (!o) setSearch("")
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-label={rest["aria-label"]}
          className={cn(
            "h-9 w-full justify-between bg-card px-2.5 font-normal",
            !value && "text-muted-foreground",
            invalid && "border-danger",
            className,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {value ? (
              <>
                <span className="num text-xs text-muted-foreground">{value}</span>
                <span className="truncate text-foreground">{selected?.description ?? "…"}</span>
              </>
            ) : (
              "Pick an item"
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[26rem] max-w-[calc(100vw-2rem)] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Number, description or category…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {isFetching && !data ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>No item matches.</CommandEmpty>
            )}
            <CommandGroup>
              {data?.items.map((i) => {
                const off = disableInactive && i.status === "I"
                return (
                  <CommandItem
                    key={i.itemNo}
                    value={String(i.itemNo)}
                    disabled={off}
                    onSelect={() => {
                      onChange(i.itemNo)
                      setOpen(false)
                      setSearch("")
                    }}
                    className="items-start"
                  >
                    <Check
                      className={cn("mt-0.5 size-4", value === i.itemNo ? "opacity-100" : "opacity-0")}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="num text-xs text-muted-foreground">{i.itemNo}</span>
                        <span className="truncate">{i.description}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="num">{formatINR(i.unitPrice)}</span>·
                        <span
                          className={cn(
                            i.stockQty <= 0 ? "text-danger" : i.stockQty <= LOW_STOCK && "text-warning",
                          )}
                        >
                          <span className="num">{formatCount(i.stockQty)}</span> in stock
                        </span>
                      </div>
                    </div>
                    {i.status === "I" && <Pill tone="neutral">Inactive</Pill>}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
