import { createBrowserRouter } from "react-router"

import { AppShell } from "@/components/layout/AppShell"
import { PageLoading } from "@/components/layout/PageLoading"

/*
 * Every page is its own chunk, fetched the first time it's visited, so the first load only carries the
 * shell. Recharts (dashboard) and the order editor no longer sit in the main bundle.
 */
export const router = createBrowserRouter([
  {
    element: <AppShell />,
    hydrateFallbackElement: <PageLoading />,
    children: [
      {
        index: true,
        lazy: () =>
          import("@/features/dashboard/DashboardPage").then((m) => ({ Component: m.DashboardPage })),
      },
      {
        path: "orders",
        lazy: () => import("@/features/orders/OrdersPage").then((m) => ({ Component: m.OrdersPage })),
      },
      {
        path: "orders/new",
        lazy: () =>
          import("@/features/orders/editor/OrderEditorPage").then((m) => ({ Component: m.NewOrderPage })),
      },
      {
        path: "orders/:ordNo",
        lazy: () =>
          import("@/features/orders/OrderDetailPage").then((m) => ({ Component: m.OrderDetailPage })),
      },
      {
        path: "orders/:ordNo/edit",
        lazy: () =>
          import("@/features/orders/editor/OrderEditorPage").then((m) => ({ Component: m.EditOrderPage })),
      },
      {
        path: "customers",
        lazy: () =>
          import("@/features/customers/CustomersPage").then((m) => ({ Component: m.CustomersPage })),
      },
      {
        path: "customers/:custNo",
        lazy: () =>
          import("@/features/customers/CustomerDetailPage").then((m) => ({
            Component: m.CustomerDetailPage,
          })),
      },
      {
        path: "items",
        lazy: () => import("@/features/items/ItemsPage").then((m) => ({ Component: m.ItemsPage })),
      },
      {
        path: "items/:itemNo",
        lazy: () => import("@/features/items/ItemDetailPage").then((m) => ({ Component: m.ItemDetailPage })),
      },
      {
        path: "audit",
        lazy: () => import("@/features/audit/AuditPage").then((m) => ({ Component: m.AuditPage })),
      },
      {
        path: "system",
        lazy: () => import("@/features/system/SystemPage").then((m) => ({ Component: m.SystemPage })),
      },
      {
        path: "*",
        lazy: () => import("@/features/system/NotFoundPage").then((m) => ({ Component: m.NotFoundPage })),
      },
    ],
  },
])
