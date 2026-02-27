import { createBrowserRouter, redirect } from "react-router";
import { loginAction, logoutAction } from "./actions/auth.actions";
import { AppShellLayout } from "./layouts/app-shell.layout";
import { guestOnlyLoader, indexRedirectLoader, requireAuthLoader } from "./route-guards";
import { LoginPage } from "../pages/auth/login.page";
import { DashboardPage } from "../pages/dashboard/dashboard.page";
import { NotFoundPage } from "../pages/not-found.page";
import { NewQuotePage } from "../pages/quotes/new-quote.page";
import { QuoteDetailPage } from "../pages/quotes/quote-detail.page";
import { QuotesPage } from "../pages/quotes/quotes.page";
import { ManualQuotePage } from "../pages/quotes/manual-quote.page";
import { UserPage } from "../pages/user/user.page";
import { ClientsPage } from "../pages/clients/clients.page";

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
        path: "quotes/new",
        loader: async () => redirect("/cotizador"),
      },
      {
        path: "cotizador",
        handle: { title: "Cotizador" },
        Component: NewQuotePage,
      },
      {
        path: "quotes/manual",
        handle: { title: "Cotización Manual" },
        Component: ManualQuotePage,
      },
      {
        path: "quotes/:quoteId",
        handle: { title: "Detalle de Cotización" },
        Component: QuoteDetailPage,
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
    ],
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
