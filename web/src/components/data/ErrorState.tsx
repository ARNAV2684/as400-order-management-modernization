import { AlertTriangle, RefreshCw } from "lucide-react"

import type { ApiError } from "@/api/errors"
import { Button } from "@/components/ui/button"

import { MessageId } from "./StatusBadge"

/** Shown in place of a list or detail when loading failed. Always offers a retry (§6.3). */
export function ErrorState({ error, onRetry }: { error: ApiError; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex animate-in flex-col items-center px-6 py-14 text-center duration-300 fade-in"
    >
      <div className="grid size-11 place-items-center rounded-full bg-danger-soft text-danger">
        <AlertTriangle aria-hidden className="size-5" />
      </div>
      <p className="mt-4 text-sm font-medium">Couldn't load this</p>
      <p className="mt-1 flex max-w-md flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
        {error.message}
        {error.id && <MessageId id={error.id} />}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="size-3.5" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Inline banner for a failed save: the form keeps its values, this explains what happened. */
export function ErrorBanner({ error, title }: { error: ApiError; title?: string }) {
  return (
    <div
      role="alert"
      className="flex animate-in gap-3 rounded-lg border border-danger/25 bg-danger-soft px-4 py-3 text-sm text-danger duration-200 fade-in slide-in-from-top-1"
    >
      <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 space-y-1">
        {title && <p className="font-semibold">{title}</p>}
        {error.errors.length > 0 && (
          <ul className="space-y-0.5">
            {error.errors.map((e, i) => (
              <li key={`${e.id}-${i}`} className="flex flex-wrap items-center gap-2">
                {e.text}
                <MessageId id={e.id} className="bg-danger/10 text-danger" />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
