import { Link } from "react-router"

import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <p className="num text-sm text-primary">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">That address isn't a page in COM.</p>
      <Button asChild className="mt-6">
        <Link to="/">Go to the dashboard</Link>
      </Button>
    </div>
  )
}
