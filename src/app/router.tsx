import { createBrowserRouter, redirect } from "react-router";
import { loginAction, logoutAction } from "./actions/auth.actions";
import { AppShellLayout } from "./layouts/app-shell.layout";
import { guestOnlyLoader, indexRedirectLoader, requireAuthLoader, requireRolesLoader } from "./route-guards";
import { LoginPage } from "../pages/auth/login.page";
import { DashboardPage } from "../pages/dashboard/dashboard.page";
import { NotFoundPage } from "../pages/not-found.page";
import { QuoteDetailPage } from "../pages/quotes/quote-detail.page";
import { QuotesPage } from "../pages/quotes/quotes.page";
import { SystemQuotePage } from "../pages/quotes/system-quote.page";
import { ExcelImportQuotePage } from "../pages/quotes/excel-import-quote.page";
import { UserPage } from "../pages/user/user.page";
import { ClientsPage } from "../pages/clients/clients.page";
import { ProductsPage } from "../pages/products/products.page";
import { UsersPage } from "../pages/users/users.page";
import { BranchesPage } from "../pages/branches/branches.page";
import { QuoteApprovalsPage } from "../pages/quotes/quote-approvals.page";
import { QuoteCatalogsPage } from "../pages/quote-catalogs/quote-catalogs.page";
import { PurchaseRequisitionsPage } from "../pages/procurement/purchase-requisitions.page";
import { ProductProcurementPage } from "../pages/products/product-procurement.page";
import { SuppliersPage } from "../pages/suppliers/suppliers.page";
import { ErpWarehousesPage } from "../pages/erp-warehouses/erp-warehouses.page";

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
          return redirect("/cotizador/sistema");
        },
      },
      {
        path: "cotizador",
        loader: async () => {
          await requireRolesLoader(["seller"])();
          return redirect("/cotizador/sistema");
        },
      },
      {
        path: "cotizador/sistema",
        loader: requireRolesLoader(["seller"]),
        handle: { title: "Cotización en sistema" },
        Component: SystemQuotePage,
      },
      {
        path: "cotizador/importar-excel",
        loader: requireRolesLoader(["seller"]),
        handle: { title: "Importar cotización Excel" },
        Component: ExcelImportQuotePage,
      },
      {
        path: "quotes/manual",
        loader: requireRolesLoader(["seller"]),
        handle: { title: "Cotización Manual" },
        Component: SystemQuotePage,
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
        path: "erp-warehouses",
        loader: requireRolesLoader(["admin"]),
        handle: { title: "Almacenes ERP" },
        Component: ErpWarehousesPage,
      },
      {
        path: "users",
        loader: requireRolesLoader(["admin", "manager"]),
        handle: { title: "Usuarios" },
        Component: UsersPage,
      },
      {
        path: "quote-catalogs",
        loader: requireRolesLoader(["admin", "manager", "purchasing"]),
        handle: { title: "Catálogos de cotización" },
        Component: QuoteCatalogsPage,
      },
      {
        path: "procurement",
        loader: requireRolesLoader(["admin", "manager", "seller", "purchasing"]),
        handle: { title: "Requisiciones de compra" },
        Component: PurchaseRequisitionsPage,
      },
      {
        path: "suppliers",
        loader: requireRolesLoader(["admin", "manager", "seller", "purchasing"]),
        handle: { title: "Proveedores" },
        Component: SuppliersPage,
      },
      {
        path: "procurement/products",
        loader: requireRolesLoader(["admin", "manager", "purchasing"]),
        handle: { title: "Productos locales en Compras" },
        Component: ProductProcurementPage,
      },
    ],
  },
  {
    path: "*",
    Component: NotFoundPage,
  },
]);
