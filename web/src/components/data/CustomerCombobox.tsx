import { useState } from "react"
import { Check, ChevronsUpDown, Loader2, X } from "lucide-react"

import { useCustomer, useCustomers } from "@/api/hooks/customers"
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
import { useDebouncedValue } from "@/lib/use-debounced-value"
import { cn } from "@/lib/utils"

import { Pill } from "./StatusBadge"

interface CustomerComboboxProps {
  id?: string
  value: number | null
  onChange: (custNo: number | null) => void
  /** Text on the button when nothing is picked. */
  placeholder: string
  /** Show an × to go back to "nothing picked" (list filter: all customers). */
  clearable?: boolean
  /** Order entry: inactive customers are listed but can't be picked (COM0010). */
  disableInactive?: boolean
  invalid?: boolean
  className?: string
  /** Needed when no <Label htmlFor={id}> names it (a combobox does not take its name from its text). */
  "aria-label"?: string
}

/** Type a number or part of a name; the API searches CSTMST. */
export function CustomerCombobox({
  id,
  value,
  onChange,
  placeholder,
  clearable,
  disableInactive,
  invalid,
  className,
  "aria-label": ariaLabel,
}: CustomerComboboxProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const q = useDebouncedValue(search.trim(), 250)
  const { data, isFetching } = useCustomers({ q, size: 20 }, open)
  const selected = useCustomer(value ?? 0).data

  const label = value ? (selected ? `${value} · ${selected.name}` : String(value)) : placeholder

  return (
    <div className={cn("relative flex items-center", className)}>
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
            aria-label={ariaLabel}
            className={cn(
              "h-9 w-full justify-between bg-card px-3 font-normal",
              !value && "text-muted-foreground",
              clearable && value && "pr-9",
              invalid && "border-danger",
            )}
          >
            <span className="truncate">{label}</span>
            {!(clearable && value) && <ChevronsUpDown className="size-4 shrink-0 opacity-50" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Number or name…" value={search} onValueChange={setSearch} />
            <CommandList>
              {isFetching && !data ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> Searching…
                </div>
              ) : (
                <CommandEmpty>No customer matches.</CommandEmpty>
              )}
              <CommandGroup>
                {data?.items.map((c) => {
                  const off = disableInactive && c.status === "I"
                  return (
                    <CommandItem
                      key={c.custNo}
                      value={String(c.custNo)}
                      disabled={off}
                      onSelect={() => {
                        onChange(c.custNo)
                        setOpen(false)
                        setSearch("")
                      }}
                    >
                      <Check className={cn("size-4", value === c.custNo ? "opacity-100" : "opacity-0")} />
                      <span className="w-11 shrink-0 num text-xs text-muted-foreground">{c.custNo}</span>
                      <span className="truncate">{c.name}</span>
                      {c.status === "I" && (
                        <Pill tone="neutral" className="ml-auto">
                          Inactive
                        </Pill>
                      )}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {clearable && value && (
        <button
          type="button"
          aria-label="Clear customer"
          onClick={() => onChange(null)}
          className="absolute right-1.5 grid size-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  )
}
