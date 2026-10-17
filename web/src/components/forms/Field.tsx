import type { ReactNode } from "react"
import { AlertCircle } from "lucide-react"

import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface FieldProps {
  id: string
  label: string
  /** Shape error (from the form) or RPG message (from /validate or a failed save). */
  error?: string
  hint?: ReactNode
  /** Right-aligned extra beside the label, e.g. "Locked" on edit. */
  aside?: ReactNode
  className?: string
  children: ReactNode
}

/** Label + control + one message line. The control must use id, aria-invalid and aria-describedby itself. */
export function Field({ id, label, error, hint, aside, className, children }: FieldProps) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id} className="text-xs font-medium text-foreground/80">
          {label}
        </Label>
        {aside}
      </div>
      {children}
      {error ? (
        <p
          id={`${id}-msg`}
          role="alert"
          className="slide-in-from-top-0.5 flex animate-in items-start gap-1.5 text-xs text-danger duration-200 fade-in"
        >
          <AlertCircle aria-hidden className="mt-px size-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}
