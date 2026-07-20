import {
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  FilePlus2,
  FileText,
  FileUp,
  MessageSquareText,
  Users,
} from "lucide-react";
import { NavLink } from "react-router";
import type { AnalyticsDashboard, AnalyticsParams } from "../../modules/analytics/services/analytics.service";
import { useBranchAnalytics, useUserAnalytics } from "../../queries/analytics/use-analytics";
import { useAuthStore } from "../../store/auth/auth.store";

type DashboardRole = "admin" | "manager" | "seller";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PENDING_APPROVAL: "Pendiente de aprobación",
  CHANGES_REQUESTED: "Cambios solicitados",
  QUOTED: "Cotizada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING: "bg-amber-100 text-amber-800",
  PENDING_APPROVAL: "bg-cyan-100 text-cyan-800",
  CHANGES_REQUESTED: "bg-amber-100 text-amber-800",
  QUOTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-orange-100 text-orange-800",
  CANCELLED: "bg-rose-100 text-rose-800",
};

const getDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getPeriod = (): Pick<AnalyticsParams, "from" | "to"> => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: getDateOnly(from), to: getDateOnly(to) };
};

const getPipelineCount = (dashboards: Array<AnalyticsDashboard | undefined>, status: string): number =>
  dashboards.reduce(
    (total, dashboard) => total + (dashboard?.pipeline.find((row) => row.status === status)?.count || 0),
    0
  );

const MetricCard = ({
  label,
  value,
  caption,
  icon,
  tone,
}: {
  label: string;
  value: number;
  caption: string;
  icon: React.ReactNode;
  tone: string;
}) => (
  <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{caption}</p>
      </div>
      <span className={`rounded-lg p-2 ${tone}`}>{icon}</span>
    </div>
  </article>
);

const QuickAction = ({
  to,
  title,
  description,
  icon,
  primary = false,
}: {
  to: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  primary?: boolean;
}) => (
  <NavLink
    to={to}
    className={`group flex min-h-24 items-center gap-3 rounded-xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      primary ? "border-blue-700 bg-blue-700 text-white" : "border-gray-200 bg-white text-gray-900"
    }`}
  >
    <span className={`rounded-lg p-2 ${primary ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold">{title}</span>
      <span className={`mt-1 block text-xs ${primary ? "text-blue-100" : "text-gray-500"}`}>{description}</span>
    </span>
    <ChevronRight className={`h-4 w-4 transition group-hover:translate-x-0.5 ${primary ? "text-blue-100" : "text-gray-400"}`} />
  </NavLink>
);

export const DashboardPage = () => {
  const user = useAuthStore((state) => state.user);
  const role = ((user?.role || "seller").trim().toLowerCase() as DashboardRole);
  const isSeller = role === "seller";
  const period = getPeriod();
  const baseParams = { ...period, branchId: user?.branchId, userId: user?.id };

  const branchMxn = useBranchAnalytics({ ...baseParams, currency: "MXN" }, !isSeller);
  const branchUsd = useBranchAnalytics({ ...baseParams, currency: "USD" }, !isSeller);
  const userMxn = useUserAnalytics({ ...baseParams, currency: "MXN" }, isSeller);
  const userUsd = useUserAnalytics({ ...baseParams, currency: "USD" }, isSeller);
  const activeQueries = isSeller ? [userMxn, userUsd] : [branchMxn, branchUsd];
  const dashboards = activeQueries.map((query) => query.data);
  const isLoading = activeQueries.some((query) => query.isLoading);
  const hasError = activeQueries.every((query) => query.isError);

  const created = dashboards.reduce((total, dashboard) => total + (dashboard?.kpis.created || 0), 0);
  const quoted = dashboards.reduce((total, dashboard) => total + (dashboard?.kpis.quoted || 0), 0);
  const approved = dashboards.reduce((total, dashboard) => total + (dashboard?.kpis.approved || 0), 0);
  const pending = dashboards.reduce((total, dashboard) => total + (dashboard?.kpis.pending || 0), 0);
  const pendingItems = dashboards.reduce((total, dashboard) => total + (dashboard?.kpis.pendingItems || 0), 0);
  const rejected = getPipelineCount(dashboards, "REJECTED");
  const cancelled = getPipelineCount(dashboards, "CANCELLED");
  const pendingQuotes = dashboards
    .flatMap((dashboard, index) =>
      (dashboard?.pendingQuotes || []).map((quote) => ({ ...quote, currency: index === 0 ? "MXN" as const : "USD" as const }))
    )
    .sort((a, b) => b.daysOpen - a.daysOpen)
    .slice(0, 6);

  const fullName = `${user?.name || ""} ${user?.lastname || ""}`.trim() || user?.username || "Usuario";
  const scopeName = isSeller ? "tu actividad" : `la sucursal ${user?.branch?.name || "asignada"}`;

  const sellerActions = [
    { to: "/cotizador", title: "Nueva cotización", description: "Captura una cotización manual", icon: <FilePlus2 className="h-5 w-5" />, primary: true },
    { to: "/cotizador?open=file", title: "Subir archivo", description: "Extrae partidas con IA", icon: <FileUp className="h-5 w-5" /> },
    { to: "/cotizador?open=text", title: "Pegar texto", description: "Procesa correo o WhatsApp", icon: <MessageSquareText className="h-5 w-5" /> },
    { to: "/quotes", title: "Mis cotizaciones", description: "Continúa borradores y pendientes", icon: <ClipboardList className="h-5 w-5" /> },
  ];

  const managementActions = [
    { to: "/quotes", title: "Cotizaciones", description: "Consulta y da seguimiento", icon: <ClipboardList className="h-5 w-5" />, primary: true },
    { to: "/analytics", title: "Indicadores", description: "Analiza rendimiento y conversión", icon: <BarChart3 className="h-5 w-5" /> },
    { to: "/users", title: "Usuarios", description: "Administra al equipo comercial", icon: <Users className="h-5 w-5" /> },
    ...(role === "admin"
      ? [{ to: "/branches", title: "Sucursales", description: "Configura la estructura operativa", icon: <Building2 className="h-5 w-5" /> }]
      : []),
  ];

  const actions = isSeller ? sellerActions : managementActions;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm sm:p-8">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">Centro de operación</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Hola, {fullName}</h1>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Aquí tienes lo que requiere atención en {scopeName} durante los últimos 30 días.
          </p>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Acciones rápidas</h2>
            <p className="mt-1 text-xs text-gray-500">Continúa con las tareas más frecuentes de tu rol.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => <QuickAction key={action.to} {...action} />)}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Resumen de 30 días</h2>
            <p className="mt-1 text-xs text-gray-500">Conteos combinados de cotizaciones MXN y USD.</p>
          </div>
          <NavLink to="/analytics" className="text-xs font-semibold text-blue-700 hover:text-blue-900">Ver indicadores</NavLink>
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl border border-gray-200 bg-white shadow-sm" />)}
          </div>
        ) : hasError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            No se pudo cargar el resumen. Puedes consultar la información desde Indicadores.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Creadas" value={created} caption="Cotizaciones iniciadas" icon={<FileText className="h-5 w-5" />} tone="bg-blue-50 text-blue-700" />
            <MetricCard label="Pendientes" value={pending} caption="Borradores o por completar" icon={<AlertTriangle className="h-5 w-5" />} tone="bg-amber-50 text-amber-700" />
            <MetricCard label="Cotizadas" value={quoted} caption="Propuestas comerciales emitidas" icon={<ClipboardList className="h-5 w-5" />} tone="bg-indigo-50 text-indigo-700" />
            <MetricCard label="Aprobadas" value={approved} caption="Aceptadas por el cliente" icon={<CheckCircle2 className="h-5 w-5" />} tone="bg-emerald-50 text-emerald-700" />
          </div>
        )}
      </section>

      {!isLoading && !hasError && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.7fr)]">
          <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Pendientes de seguimiento</h2>
                <p className="mt-1 text-xs text-gray-500">Primero aparecen las cotizaciones con mayor antigüedad.</p>
              </div>
              <NavLink to="/quotes" className="shrink-0 text-xs font-semibold text-blue-700 hover:text-blue-900">Ver todas</NavLink>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
                  <tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Antigüedad</th><th className="px-4 py-3">Moneda</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pendingQuotes.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">No hay cotizaciones pendientes en este periodo.</td></tr>}
                  {pendingQuotes.map((quote) => (
                    <tr key={quote.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><NavLink to={`/quotes/${quote.id}`} className="font-semibold text-blue-700 hover:text-blue-900">{quote.quoteNumber}</NavLink></td>
                      <td className="px-4 py-3 text-gray-700">{quote.customerName}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_STYLES[quote.status] || "bg-gray-100 text-gray-700"}`}>{STATUS_LABELS[quote.status] || quote.status}</span></td>
                      <td className="px-4 py-3 text-gray-600">{quote.daysOpen} días</td>
                      <td className="px-4 py-3 text-xs font-semibold text-gray-600">{quote.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>

          <aside className="space-y-3">
            <div className={`rounded-xl border p-4 ${pendingItems > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"}`}>
              <div className="flex items-start gap-3">
                {pendingItems > 0 ? <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" /> : <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-700" />}
                <div>
                  <p className={`text-sm font-semibold ${pendingItems > 0 ? "text-amber-950" : "text-emerald-950"}`}>{pendingItems} partidas por revisar</p>
                  <p className={`mt-1 text-xs leading-5 ${pendingItems > 0 ? "text-amber-800" : "text-emerald-800"}`}>
                    {pendingItems > 0 ? "Hay partidas sin vincular o que requieren validación." : "No hay partidas pendientes de validación."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resultado del periodo</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="flex items-center justify-between"><span className="text-gray-600">Rechazadas por cliente</span><span className="font-semibold text-orange-700">{rejected}</span></div>
                <div className="flex items-center justify-between"><span className="text-gray-600">Canceladas internamente</span><span className="font-semibold text-rose-700">{cancelled}</span></div>
              </div>
              <NavLink to="/analytics" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-900">
                Analizar resultados <ChevronRight className="h-3.5 w-3.5" />
              </NavLink>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
};
