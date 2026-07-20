import { createBrowserRouter, redirect } from "react-router";
import { loginAction, logoutAction } from "./actions/auth.actions";
import { AppShellLayout } from "./layouts/app-shell.layout";
import { guestOnlyLoader, indexRedirectLoader, requireAuthLoader, requireRolesLoader } from "./route-guards";
import { LoginPage } from "../pages/auth/login.page";
import { DashboardPage } from "../pages/dashboard/dashboard.page";
import { NotFoundPage } from "../pages/not-found.page";
import { QuoteDetailPage } from "../pages/quotes/quote-detail.page";
import { QuotesPage } from "../pages/quotes/quotes.page";
import { ManualQuotePage } from "../pages/quotes/manual-quote.page";
import { UserPage } from "../pages/user/user.page";
import { ClientsPage } from "../pages/clients/clients.page";
import { ProductsPage } from "../pages/products/products.page";
import { UsersPage } from "../pages/users/users.page";
import { BranchesPage } from "../pages/branches/branches.page";
import { QuoteApprovalsPage } from "../pages/quotes/quote-approvals.page";

export const appRouter = createBrowserRouter([
  {
    path: "/login",
    loader: guestOnlyLoader,
    action: loginAction,
    Component: LoginPage,
  },
  {
    path: "/logout",
    action: logoutAction,
  },
  {
    path: "/",
    loader: requireAuthLoader,
    Component: AppShellLayout,
    children: [
      {
        index: true,
        loader: indexRedirectLoader,
      },
      {
        path: "home",
        handle: { title: "Dashboard" },
        Component: DashboardPage,
      },
      {
        path: "dashboard",
        loader: async () => redirect("/home"),
      },
      {
        path: "quotes",
        handle: { title: "Cotizaciones" },
        Component: QuotesPage,
      },
      {
        path: "analytics",
        handle: { title: "Indicadores" },
        lazy: async () => {
          const { AnalyticsPage } = await import("../pages/analytics/analytics.page");
          return { Component: AnalyticsPage };
        },
      },
      {
        path: "quotes/new",
        loader: async () => {
          await requireRolesLoader(["seller"])();
          return redirect("/cotizador");
        },
      },
      {
        path: "cotizador",
        loader: requireRolesLoader(["seller"]),
        handle: { title: "Cotizador" },
        Component: ManualQuotePage,
      },
      {
        path: "quotes/manual",
        loader: requireRolesLoader(["seller"]),
        handle: { title: "Cotización Manual" },
        Component: ManualQuotePage,
      },
      {
        path: "quotes/:quoteId",
        handle: { title: "Detalle de Cotización" },
        Component: QuoteDetailPage,
      },
      {
        path: "quote-approvals",
        loader: requireRolesLoader(["admin", "manager"]),
        handle: { title: "Aprobación de Cotizaciones" },
        Component: QuoteApprovalsPage,
      },
      {
        path: "user",
        handle: { title: "Perfil" },
        Component: UserPage,
      },
      {
        path: "clients",
        handle: { title: "Clientes" },
        Component: ClientsPage,
      },
      {
        path: "products",
        handle: { title: "Productos" },
        Component: ProductsPage,
      },
      {
        path: "branches",
        loader: requireRolesLoader(["admin"]),
        handle: { title: "Sucursales" },
        Component: BranchesPage,
      },
      {
        path: "users",
        loader: requireRolesLoader(["admin", "manager"]),
        handle: { title: "Usuarios" },
        Component: UsersPage,
      },
    ],
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
