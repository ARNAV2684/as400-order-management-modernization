import { Toaster } from "sonner"

import { useTheme } from "@/components/theme/theme-context"

export function AppToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      theme={resolved}
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: { toast: "font-sans border-border", description: "text-muted-foreground" },
      }}
    />
  )
}
