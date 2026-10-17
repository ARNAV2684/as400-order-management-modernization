import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "react-router"

import { ApiError } from "@/api/errors"
import { router } from "@/app/router"
import { AppToaster } from "@/components/layout/AppToaster"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { TooltipProvider } from "@/components/ui/tooltip"

import "./index.css"

// Handoff §6.7: lists stale after 10 s; GETs retried once, but never when the backend is down
// or the answer was a 4xx (retrying a "not found" can't help); mutations never retried.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      refetchOnWindowFocus: false,
      retry: (count, error) =>
        count < 1 && !(error instanceof ApiError && (error.isBackendDown || error.status < 500)),
    },
    mutations: { retry: false },
  },
})

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={250}>
          <RouterProvider router={router} />
          <AppToaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
)
