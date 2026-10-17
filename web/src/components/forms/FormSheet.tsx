import { useState, type ReactNode } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface FormSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: ReactNode
  description: ReactNode
  /** Unsaved edits: closing asks first instead of silently dropping them (§6.5). */
  dirty: boolean
  /** Block closing while a save is in flight. */
  busy?: boolean
  children: ReactNode
  footer: ReactNode
}

/** Side panel for add / edit forms. Esc or clicking outside closes it, with a guard for unsaved changes. */
export function FormSheet({
  open,
  onOpenChange,
  title,
  description,
  dirty,
  busy,
  children,
  footer,
}: FormSheetProps) {
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const requestClose = (next: boolean) => {
    if (next) return onOpenChange(true)
    if (busy) return
    if (dirty) setConfirmDiscard(true)
    else onOpenChange(false)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={requestClose}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b px-6 pt-5 pb-4">
            <SheetTitle className="text-base">{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
          <div className="flex items-center justify-end gap-2 border-t bg-muted/30 px-6 py-3">{footer}</div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>What you typed hasn't been saved.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => onOpenChange(false)}>
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
