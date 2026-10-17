import { Loader2 } from "lucide-react"

import { useBackendStatus } from "@/api/hooks/system"
import { Button } from "@/components/ui/button"

/**
 * Submit button that is off whenever IBM i can't be reached (§6.4); the reason is shown as text beside it.
 * Plain text instead of a tooltip: a disabled button can't show one, and a focusable wrapper span just to
 * host it adds a pointless tab stop inside the dialog.
 */
export function SaveButton({
  form,
  saving,
  label = "Save",
}: {
  form: string
  saving: boolean
  label?: string
}) {
  const status = useBackendStatus()
  const down = status === "tunnel-down" || status === "api-down"
  return (
    <>
      {down && (
        <span className="mr-auto text-xs text-danger">Saving is off: IBM i can&apos;t be reached.</span>
      )}
      <Button type="submit" form={form} disabled={saving || status !== "ok"} className="min-w-20">
        {saving && <Loader2 className="animate-spin" />}
        {saving ? "Saving…" : label}
      </Button>
    </>
  )
}
