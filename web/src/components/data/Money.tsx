import { formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"

/** Rupee amount from a decimal string, in the mono face so columns line up. */
export function Money({ value, className }: { value: string | null | undefined; className?: string }) {
  return <span className={cn("num whitespace-nowrap", className)}>{formatINR(value)}</span>
}
