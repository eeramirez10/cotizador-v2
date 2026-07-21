import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, BadgeDollarSign, CheckCircle2, Clock3, FileChartColumn, FileSpreadsheet, PackageCheck, Percent, TrendingUp } from "lucide-react";
import { NavLink } from "react-router";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsDashboard, AnalyticsParams } from "../../modules/analytics/services/analytics.service";
import { BranchesService } from "../../modules/branches/services/branches.service";
import { UsersService } from "../../modules/users/services/users.service";
import { useBranchAnalytics, useUserAnalytics } from "../../queries/analytics/use-analytics";
import { useAuthStore } from "../../store/auth/auth.store";

type DashboardTab = "branch" | "user";
type Currency = "MXN" | "USD";

const CHART_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#475569"];
const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PENDING_APPROVAL: "Pendiente de aprobación",
  CHANGES_REQUESTED: "Cambios solicitados",
  QUOTED: "Cotizada",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  SUPERSEDED: "Reemplazada",
};
const CHANNEL_LABELS: Record<string, string> = {
  UNSPECIFIED: "Sin especificar",
  EMAIL: "Correo",
  PHONE: "Teléfono",
  WHATSAPP: "WhatsApp",
  AI_ASSISTANT: "Asistente IA",
  IN_PERSON: "Presencial",
  OTHER: "Otro",
};
const REJECTION_LABELS: Record<string, string> = {
  PRICE_HIGH: "Precio elevado", COST_HIGH: "Costo elevado", MATERIAL_UNAVAILABLE: "Falta de material", DELIVERY_TIME: "Tiempo de entrega", COMPETITOR_SELECTED: "Otro proveedor", COMMERCIAL_TERMS: "Condiciones comerciales", SPECIFICATION_MISMATCH: "Especificación no cumple", LATE_QUOTATION: "Tardanza al cotizar", PROJECT_CANCELLED: "Proyecto cancelado", NO_CUSTOMER_RESPONSE: "Sin respuesta", DUPLICATE_OR_ERROR: "Duplicada o error", OTHER: "Otro",
};

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);
const getDefaultPeriod = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: dateOnly(from), to: dateOnly(to) };
};
const formatMoney = (value: number, currency: Currency) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
const formatShortDate = (value: string) => new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(`${value}T00:00:00`));

const KpiCard = ({ label, value, caption, icon }: { label: string; value: string; caption: string; icon: React.ReactNode }) => (
  <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-gray-900">{value}</p>
        <p className="mt-1 text-xs text-gray-500">{caption}</p>
      </div>
      <span className="rounded-lg bg-slate-100 p-2 text-slate-700">{icon}</span>
    </div>
  </article>
);

const ChartCard = ({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) => (
  <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
    <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
    <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
    <div className="mt-4 h-72">{children}</div>
  </article>
);

const EmptyChart = () => <div className="flex h-full items-center justify-center text-sm text-gray-400">Sin datos en este periodo.</div>;

const mergeCountRows = <T extends { count: number; amount: number }>(
  sources: T[][],
  getKey: (row: T) => string
): T[] => {
  const merged = new Map<string, T>();
  for (const source of sources) {
    for (const row of source) {
      const key = getKey(row);
      const current = merged.get(key);
      merged.set(key, current ? { ...current, count: current.count + row.count, amount: 0 } : { ...row, amount: 0 });
    }
  }
  return [...merged.values()];
};

const DashboardContent = ({ mxnData, usdData, tab }: { mxnData: AnalyticsDashboard; usdData: AnalyticsDashboard; tab: DashboardTab }) => {
  const dashboards = [mxnData, usdData];
  const totalKpi = (key: keyof AnalyticsDashboard["kpis"]): number =>
    dashboards.reduce((total, dashboard) => total + Number(dashboard.kpis[key]), 0);
  const moneyByCurrency = (key: "quotedAmount" | "approvedAmount" | "averageTicket" | "orderAmount") =>
    `MXN ${formatMoney(mxnData.kpis[key], "MXN")} · USD ${formatMoney(usdData.kpis[key], "USD")}`;
  const statusMetric = (status: string, dashboard: AnalyticsDashboard) =>
    dashboard.pipeline.find((row) => row.status === status) ?? { count: 0, amount: 0 };
  const rejectedMxn = statusMetric("REJECTED", mxnData);
  const rejectedUsd = statusMetric("REJECTED", usdData);
  const cancelledMxn = statusMetric("CANCELLED", mxnData);
  const cancelledUsd = statusMetric("CANCELLED", usdData);
  const statusAmountByCurrency = (
    mxn: { amount: number },
    usd: { amount: number }
  ) => `Cotizado: MXN ${formatMoney(mxn.amount, "MXN")} · USD ${formatMoney(usd.amount, "USD")}`;
  const pipeline = mergeCountRows(dashboards.map((dashboard) => dashboard.pipeline), (row) => row.status)
    .map((row) => ({ ...row, label: STATUS_LABELS[row.status] || row.status }));
  const channels = mergeCountRows(dashboards.map((dashboard) => dashboard.channels), (row) => row.channel)
    .map((row) => ({ ...row, label: CHANNEL_LABELS[row.channel] || row.channel }));
  const captureMethods = mergeCountRows(dashboards.map((dashboard) => dashboard.captureMethods ?? []), (row) => row.method).map((row) => ({
    ...row,
    label: row.method === "EXCEL_IMPORT" ? "Importadas desde Excel" : "Capturadas en el sistema",
  }));
  const systemCapture = captureMethods.find((row) => row.method === "SYSTEM") ?? { count: 0, amount: 0 };
  const excelCapture = captureMethods.find((row) => row.method === "EXCEL_IMPORT") ?? { count: 0, amount: 0 };
  const attribution = [
    { label: "Directas", value: dashboards.reduce((total, dashboard) => total + dashboard.attribution.direct, 0) },
    { label: "Proporcionadas", value: dashboards.reduce((total, dashboard) => total + dashboard.attribution.provided, 0) },
  ].filter((row) => row.value > 0);
  const rejectionReasons = mergeCountRows(dashboards.map((dashboard) => dashboard.rejectionReasons), (row) => row.reason)
    .map((row) => ({ ...row, label: REJECTION_LABELS[row.reason] || row.reason }));
  const trendMap = new Map<string, { date: string; created: number; quoted: number; approved: number; orders: number }>();
  for (const dashboard of dashboards) {
    for (const row of dashboard.trend) {
      const current = trendMap.get(row.date) ?? { date: row.date, created: 0, quoted: 0, approved: 0, orders: 0 };
      current.created += row.created;
      current.quoted += row.quoted;
      current.approved += row.approved;
      current.orders += row.orders;
      trendMap.set(row.date, current);
    }
  }
  const trend = [...trendMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  const sellerMap = new Map<string, { name: string; quotes: number; approved: number; quotedMxn: number; quotedUsd: number; approvedMxn: number; approvedUsd: number }>();
  for (const [currency, dashboard] of [["MXN", mxnData], ["USD", usdData]] as const) {
    for (const row of dashboard.sellerRanking) {
      const current = sellerMap.get(row.userId) ?? { name: row.name, quotes: 0, approved: 0, quotedMxn: 0, quotedUsd: 0, approvedMxn: 0, approvedUsd: 0 };
      current.quotes += row.quotes;
      current.approved += row.approved;
      if (currency === "MXN") {
        current.quotedMxn += row.quotedAmount;
        current.approvedMxn += row.approvedAmount;
      } else {
        current.quotedUsd += row.quotedAmount;
        current.approvedUsd += row.approvedAmount;
      }
      sellerMap.set(row.userId, current);
    }
  }
  const sellerRanking = [...sellerMap.values()]
    .map((row) => ({ ...row, conversionRate: row.quotes > 0 ? (row.approved / row.quotes) * 100 : 0 }))
    .sort((a, b) => b.approvedMxn + b.approvedUsd - (a.approvedMxn + a.approvedUsd));
  const providerMap = new Map<string, { name: string; branchName: string; quotes: number; approved: number; approvedMxn: number; approvedUsd: number }>();
  for (const [currency, dashboard] of [["MXN", mxnData], ["USD", usdData]] as const) {
    for (const row of dashboard.providerRanking) {
      const current = providerMap.get(row.userId) ?? { name: row.name, branchName: row.branchName, quotes: 0, approved: 0, approvedMxn: 0, approvedUsd: 0 };
      current.quotes += row.quotes;
      current.approved += row.approved;
      if (currency === "MXN") current.approvedMxn += row.approvedAmount;
      else current.approvedUsd += row.approvedAmount;
      providerMap.set(row.userId, current);
    }
  }
  const providerRanking = [...providerMap.values()]
    .sort((a, b) => b.approvedMxn + b.approvedUsd - (a.approvedMxn + a.approvedUsd));
  const pendingQuotes = ([
    ...mxnData.pendingQuotes.map((quote) => ({ ...quote, currency: "MXN" as const })),
    ...usdData.pendingQuotes.map((quote) => ({ ...quote, currency: "USD" as const })),
  ]).sort((a, b) => b.daysOpen - a.daysOpen).slice(0, 10);

  return (
    <div className="mt-6 space-y-6">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Creadas" value={`${totalKpi("created")}`} caption="Cotizaciones del periodo" icon={<FileChartColumn className="h-5 w-5" />} />
        <KpiCard label="Cotizadas" value={`${totalKpi("quoted")}`} caption={moneyByCurrency("quotedAmount")} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiCard label="Aprobadas" value={`${totalKpi("approved")}`} caption={moneyByCurrency("approvedAmount")} icon={<CheckCircle2 className="h-5 w-5" />} />
        <KpiCard label="Rechazadas por cliente" value={`${rejectedMxn.count + rejectedUsd.count}`} caption={statusAmountByCurrency(rejectedMxn, rejectedUsd)} icon={<Activity className="h-5 w-5" />} />
        <KpiCard label="Canceladas internamente" value={`${cancelledMxn.count + cancelledUsd.count}`} caption={statusAmountByCurrency(cancelledMxn, cancelledUsd)} icon={<Activity className="h-5 w-5" />} />
        <KpiCard label="Conversión" value={`${totalKpi("quoted") > 0 ? ((totalKpi("approved") / totalKpi("quoted")) * 100).toFixed(1) : "0.0"}%`} caption="Aprobadas sobre cotizadas" icon={<Percent className="h-5 w-5" />} />
        <KpiCard label="Ticket promedio" value="MXN y USD" caption={moneyByCurrency("averageTicket")} icon={<BadgeDollarSign className="h-5 w-5" />} />
        <KpiCard label="Pedidos generados" value={`${totalKpi("ordersGenerated")}`} caption={moneyByCurrency("orderAmount")} icon={<PackageCheck className="h-5 w-5" />} />
        <KpiCard label="Pendientes" value={`${totalKpi("pending")}`} caption="Borrador o pendiente" icon={<Clock3 className="h-5 w-5" />} />
        <KpiCard label="Partidas por revisar" value={`${totalKpi("pendingItems")}`} caption="Sin vincular o con revisión" icon={<Activity className="h-5 w-5" />} />
        <KpiCard label="Hechas en el sistema" value={`${systemCapture.count}`} caption="Todas las monedas del periodo" icon={<FileChartColumn className="h-5 w-5" />} />
        <KpiCard label="Importadas desde Excel" value={`${excelCapture.count}`} caption="Todas las monedas del periodo" icon={<FileSpreadsheet className="h-5 w-5" />} />
      </section>

      {tab === "user" && (
        <section className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase text-blue-700">Cotizaciones trabajadas</p>
            <p className="mt-2 text-2xl font-bold text-blue-950">{mxnData.contribution.workedQuotes + usdData.contribution.workedQuotes}</p>
            <p className="text-sm text-blue-800">Aprobado: MXN {formatMoney(mxnData.contribution.workedApprovedAmount, "MXN")} · USD {formatMoney(usdData.contribution.workedApprovedAmount, "USD")}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-semibold uppercase text-emerald-700">Oportunidades proporcionadas</p>
            <p className="mt-2 text-2xl font-bold text-emerald-950">{mxnData.contribution.providedQuotes + usdData.contribution.providedQuotes}</p>
            <p className="text-sm text-emerald-800">Aprobado atribuido: MXN {formatMoney(mxnData.contribution.providedApprovedAmount, "MXN")} · USD {formatMoney(usdData.contribution.providedApprovedAmount, "USD")}</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="Tendencia comercial" subtitle="Cotizaciones creadas, cotizadas, aprobadas y pedidos por día.">
          {trend.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="createdGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} /><stop offset="95%" stopColor="#2563eb" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(value) => formatShortDate(String(value))} />
                <Legend />
                <Area type="monotone" dataKey="created" name="Creadas" stroke="#2563eb" fill="url(#createdGradient)" strokeWidth={2} />
                <Area type="monotone" dataKey="quoted" name="Cotizadas" stroke="#d97706" fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="approved" name="Aprobadas" stroke="#059669" fillOpacity={0} strokeWidth={2} />
                <Area type="monotone" dataKey="orders" name="Pedidos" stroke="#7c3aed" fillOpacity={0} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Pipeline actual" subtitle="Cantidad de cotizaciones por estado dentro del periodo.">
          {pipeline.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pipeline} layout="vertical" margin={{ top: 8, right: 20, left: 20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={85} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => [`${value}`, "Cotizaciones"]} />
                <Bar dataKey="count" name="Cotizaciones" radius={[0, 6, 6, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Canales de origen" subtitle="Cómo llegaron las oportunidades comerciales.">
          {channels.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={channels} dataKey="count" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={2}>
                  {channels.map((row, index) => <Cell key={row.channel} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, "Cotizaciones"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Atribución comercial" subtitle="Cotizaciones directas frente a oportunidades proporcionadas.">
          {attribution.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={attribution} dataKey="value" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  <Cell fill="#2563eb" /><Cell fill="#059669" />
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, "Cotizaciones"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Método de captura" subtitle="Adopción del cotizador frente a cotizaciones elaboradas en Excel.">
          {captureMethods.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={captureMethods} dataKey="count" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3}>
                  <Cell fill="#0f766e" /><Cell fill="#d97706" />
                </Pie>
                <Tooltip formatter={(value) => [`${value}`, "Cotizaciones"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Motivos de rechazo" subtitle="Principales causas de pérdida comercial.">
          {rejectionReasons.length === 0 ? <EmptyChart /> : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rejectionReasons} layout="vertical" margin={{ top: 8, right: 20, left: 42, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(value) => [`${value}`, "Rechazos"]} />
                <Bar dataKey="count" name="Rechazos" radius={[0, 6, 6, 0]} fill="#ea580c" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </section>

      {tab === "branch" && (
        <section className="grid gap-4 xl:grid-cols-2">
          <RankingTable title="Rendimiento por vendedor" headers={["Vendedor", "Cotizaciones", "Aprobadas", "Conversión", "Cotizado MXN", "Cotizado USD", "Aprobado MXN", "Aprobado USD"]} rows={sellerRanking.slice(0, 10).map((row) => [row.name, `${row.quotes}`, `${row.approved}`, `${row.conversionRate.toFixed(1)}%`, formatMoney(row.quotedMxn, "MXN"), formatMoney(row.quotedUsd, "USD"), formatMoney(row.approvedMxn, "MXN"), formatMoney(row.approvedUsd, "USD")])} />
          <RankingTable title="Oportunidades proporcionadas" headers={["Usuario", "Sucursal", "Proporcionadas", "Aprobadas", "Aprobado MXN", "Aprobado USD"]} rows={providerRanking.slice(0, 10).map((row) => [row.name, row.branchName, `${row.quotes}`, `${row.approved}`, formatMoney(row.approvedMxn, "MXN"), formatMoney(row.approvedUsd, "USD")])} />
        </section>
      )}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Pendientes de seguimiento</h3>
          <p className="mt-1 text-xs text-gray-500">Las cotizaciones abiertas con mayor antigüedad.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500"><tr><th className="px-4 py-3">Folio</th><th className="px-4 py-3">Cliente</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3">Antigüedad</th><th className="px-4 py-3">Moneda</th><th className="px-4 py-3 text-right">Monto</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {pendingQuotes.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No hay pendientes en este periodo.</td></tr>}
              {pendingQuotes.map((quote) => <tr key={quote.id} className="hover:bg-gray-50"><td className="px-4 py-3 font-semibold text-blue-700"><NavLink to={`/quotes/${quote.id}`}>{quote.quoteNumber}</NavLink></td><td className="px-4 py-3 text-gray-700">{quote.customerName}</td><td className="px-4 py-3 text-gray-600">{STATUS_LABELS[quote.status] || quote.status}</td><td className="px-4 py-3 text-gray-600">{quote.daysOpen} días</td><td className="px-4 py-3 text-xs font-semibold text-gray-600">{quote.currency}</td><td className="px-4 py-3 text-right font-semibold text-gray-800">{formatMoney(quote.total, quote.currency)}</td></tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

const RankingTable = ({ title, headers, rows }: { title: string; headers: string[]; rows: string[][] }) => (
  <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
    <div className="border-b border-gray-200 px-4 py-3"><h3 className="text-sm font-semibold text-gray-900">{title}</h3></div>
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-gray-200 text-xs"><thead className="bg-gray-50 text-left uppercase text-gray-500"><tr>{headers.map((header) => <th key={header} className="px-3 py-3">{header}</th>)}</tr></thead><tbody className="divide-y divide-gray-100">{rows.length === 0 && <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-gray-500">Sin datos.</td></tr>}{rows.map((row, rowIndex) => <tr key={`${row[0]}-${rowIndex}`} className="hover:bg-gray-50">{row.map((cell, index) => <td key={`${index}-${cell}`} className={`px-3 py-3 ${index === 0 ? "font-semibold text-gray-800" : "text-gray-600"}`}>{cell}</td>)}</tr>)}</tbody></table></div>
  </article>
);

export const AnalyticsPage = () => {
  const actor = useAuthStore((state) => state.user);
  const role = (actor?.role || "").toLowerCase();
  const canSeeBranch = role === "admin" || role === "manager";
  const canSelectScope = role === "admin" || role === "manager";
  const [tab, setTab] = useState<DashboardTab>(canSeeBranch ? "branch" : "user");
  const [period, setPeriod] = useState(getDefaultPeriod);
  const [branchId, setBranchId] = useState(actor?.branchId || "");
  const [userId, setUserId] = useState(actor?.id || "");

  const branchesQuery = useQuery({ queryKey: ["analytics", "branches"], queryFn: () => BranchesService.list(), enabled: role === "admin", staleTime: 60_000 });
  const usersQuery = useQuery({ queryKey: ["analytics", "users"], queryFn: () => UsersService.listActiveQuoteProviders({ page: 1, pageSize: 100 }), enabled: canSelectScope, staleTime: 60_000 });
  const users = useMemo(() => {
    const rows = usersQuery.data?.items || [];
    return role === "manager" ? rows.filter((user) => user.branch.id === actor?.branchId) : rows;
  }, [actor?.branchId, role, usersQuery.data?.items]);

  const baseParams = { from: period.from, to: period.to, branchId: branchId || undefined, userId: userId || undefined };
  const mxnParams: AnalyticsParams = { ...baseParams, currency: "MXN" };
  const usdParams: AnalyticsParams = { ...baseParams, currency: "USD" };
  const branchMxnQuery = useBranchAnalytics(mxnParams, tab === "branch" && canSeeBranch);
  const branchUsdQuery = useBranchAnalytics(usdParams, tab === "branch" && canSeeBranch);
  const userMxnQuery = useUserAnalytics(mxnParams, tab === "user");
  const userUsdQuery = useUserAnalytics(usdParams, tab === "user");
  const activeMxnQuery = tab === "branch" ? branchMxnQuery : userMxnQuery;
  const activeUsdQuery = tab === "branch" ? branchUsdQuery : userUsdQuery;
  const setPreset = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - (days - 1));
    setPeriod({ from: dateOnly(from), to: dateOnly(to) });
  };

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-xl font-bold text-gray-900">Indicadores comerciales</h2><p className="mt-1 text-sm text-gray-500">Avance, conversión, atribución y pedidos generados.</p></div>
        {canSeeBranch && <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1 shadow-sm"><button onClick={() => setTab("branch")} className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === "branch" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Sucursal</button><button onClick={() => setTab("user")} className={`rounded-md px-4 py-2 text-sm font-semibold ${tab === "user" ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`}>Mi rendimiento</button></div>}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div><label className="block text-xs font-semibold uppercase text-gray-500">Desde</label><input type="date" value={period.from} onChange={(e) => setPeriod((current) => ({ ...current, from: e.target.value }))} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
        <div><label className="block text-xs font-semibold uppercase text-gray-500">Hasta</label><input type="date" value={period.to} onChange={(e) => setPeriod((current) => ({ ...current, to: e.target.value }))} className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
        {tab === "branch" && role === "admin" && <div><label className="block text-xs font-semibold uppercase text-gray-500">Sucursal</label><select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="mt-1 min-w-48 rounded-md border border-gray-300 px-3 py-2 text-sm">{branchesQuery.data?.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>}
        {tab === "user" && canSelectScope && <div><label className="block text-xs font-semibold uppercase text-gray-500">Usuario</label><select value={userId} onChange={(e) => setUserId(e.target.value)} className="mt-1 min-w-56 rounded-md border border-gray-300 px-3 py-2 text-sm"><option value={actor?.id || ""}>Mi rendimiento</option>{users.filter((user) => user.id !== actor?.id).map((user) => <option key={user.id} value={user.id}>{user.fullName} · {user.branch.name}</option>)}</select></div>}
        <div className="flex gap-2">{[7, 30, 90].map((days) => <button key={days} onClick={() => setPreset(days)} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50">{days} días</button>)}</div>
      </div>

      <p className="mt-3 text-xs text-gray-500">Los conteos y gráficos consideran cotizaciones en MXN y USD. Los importes se presentan separados por moneda.</p>

      {(activeMxnQuery.isLoading || activeUsdQuery.isLoading) && <div className="mt-6 flex min-h-80 items-center justify-center rounded-xl border border-gray-200 bg-white text-sm text-gray-500">Cargando indicadores...</div>}
      {(activeMxnQuery.isError || activeUsdQuery.isError) && <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{activeMxnQuery.error instanceof Error ? activeMxnQuery.error.message : activeUsdQuery.error instanceof Error ? activeUsdQuery.error.message : "No se pudieron cargar los indicadores."}</div>}
      {activeMxnQuery.data && activeUsdQuery.data && <DashboardContent mxnData={activeMxnQuery.data} usdData={activeUsdQuery.data} tab={tab} />}
    </section>
  );
};
