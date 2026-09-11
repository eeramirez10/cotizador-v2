import {
  BarChart3,
  Building2,
  CalendarClock,
  Clock3,
  Globe2,
  Loader2,
  Pencil,
  Plus,
  Power,
  Search,
  Send,
  Smartphone,
  X,
} from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import type { ManagedUser } from "../../modules/users/services/users.service";
import {
  type ManagerReportFrequency,
  type ManagerReportRange,
  type ManagerReportScope,
  type ManagerReportSubscription,
  type UpsertManagerReportSubscriptionInput,
} from "../../modules/reports/services/report-subscriptions.service";
import { useBranchesList } from "../../queries/branches/use-branches";
import {
  useCreateReportSubscription,
  useReportSubscriptions,
  useSendManagerReportNow,
  useSetReportSubscriptionActive,
  useUpdateReportSubscription,
} from "../../queries/reports/use-report-subscriptions";
import { useUsers } from "../../queries/users/use-users";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

interface ReportSubscriptionForm {
  recipientUserId: string;
  scope: ManagerReportScope;
  branchId: string;
  frequency: ManagerReportFrequency;
  reportRange: ManagerReportRange;
  dayOfWeek: string;
  dayOfMonth: string;
  time: string;
  timezone: string;
}

const EMPTY_FORM: ReportSubscriptionForm = {
  recipientUserId: "",
  scope: "BRANCH",
  branchId: "",
  frequency: "WEEKLY",
  reportRange: "MONTH_TO_DATE",
  dayOfWeek: "1",
  dayOfMonth: "1",
  time: "08:00",
  timezone: "America/Mexico_City",
};

const WEEK_DAYS = [
  { value: "1", label: "Lunes" },
  { value: "2", label: "Martes" },
  { value: "3", label: "Miércoles" },
  { value: "4", label: "Jueves" },
  { value: "5", label: "Viernes" },
  { value: "6", label: "Sábado" },
  { value: "7", label: "Domingo" },
];

const TIMEZONES = [
  { value: "America/Mexico_City", label: "Centro de México" },
  { value: "America/Monterrey", label: "Monterrey" },
  { value: "America/Cancun", label: "Cancún" },
  { value: "America/Chihuahua", label: "Chihuahua" },
  { value: "America/Hermosillo", label: "Hermosillo" },
  { value: "America/Mazatlan", label: "Mazatlán" },
  { value: "America/Tijuana", label: "Tijuana" },
];

const REPORT_RANGES: Array<{ value: ManagerReportRange; label: string; description: string }> = [
  { value: "MONTH_TO_DATE", label: "Mes actual hasta hoy", description: "Acumulado del primer día del mes a la fecha." },
  { value: "WEEK_TO_DATE", label: "Semana actual hasta hoy", description: "Acumulado desde el lunes de esta semana." },
  { value: "PREVIOUS_DAY", label: "Día anterior", description: "Solo la actividad completa de ayer." },
  { value: "PREVIOUS_WEEK", label: "Semana anterior completa", description: "Del lunes al domingo de la semana pasada." },
  { value: "PREVIOUS_MONTH", label: "Mes anterior completo", description: "Todo el mes calendario anterior." },
  { value: "LAST_7_DAYS", label: "Últimos 7 días", description: "Ventana móvil incluyendo el día actual." },
  { value: "LAST_30_DAYS", label: "Últimos 30 días", description: "Ventana móvil incluyendo el día actual." },
];

const ROLE_LABELS = {
  ADMIN: "Administrador",
  MANAGER: "Manager",
} as const;

const hasValidWhatsApp = (user: ManagedUser): boolean => {
  const digits = (user.phone || "").replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
};

const formatPhone = (value: string | null): string => {
  if (!value) return "Sin WhatsApp";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `${digits.slice(0, 2)} ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith("52")) {
    return `+52 ${digits.slice(2, 4)} ${digits.slice(4, 8)} ${digits.slice(8)}`;
  }
  return value;
};

const formatSchedule = (subscription: ManagerReportSubscription): string => {
  const time = `${String(subscription.sendHour).padStart(2, "0")}:${String(subscription.sendMinute).padStart(2, "0")}`;
  if (subscription.frequency === "DAILY") return `Diario a las ${time}`;
  if (subscription.frequency === "WEEKLY") {
    const day = WEEK_DAYS.find((item) => Number(item.value) === subscription.dayOfWeek)?.label || "Día no definido";
    return `${day} a las ${time}`;
  }
  return `Día ${subscription.dayOfMonth || "-"} a las ${time}`;
};

const formatFrequency = (frequency: ManagerReportFrequency): string => ({
  DAILY: "Diario",
  WEEKLY: "Semanal",
  MONTHLY: "Mensual",
}[frequency]);

const formatReportRange = (reportRange: ManagerReportRange): string =>
  REPORT_RANGES.find((item) => item.value === reportRange)?.label || reportRange;

const formatAuditDate = (value: string): string => new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
}).format(new Date(value));

export const ReportSubscriptionsPage = () => {
  const currentUser = useAuthStore((state) => state.user);
  const isAdmin = (currentUser?.role || "").trim().toLowerCase() === "admin";
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<ManagerReportSubscription | null>(null);
  const [form, setForm] = useState<ReportSubscriptionForm>(EMPTY_FORM);

  const subscriptionsQuery = useReportSubscriptions();
  const usersQuery = useUsers({ page: 1, pageSize: 100 });
  const branchesQuery = useBranchesList();
  const createMutation = useCreateReportSubscription();
  const updateMutation = useUpdateReportSubscription();
  const statusMutation = useSetReportSubscriptionActive();
  const sendNowMutation = useSendManagerReportNow();
  const savePending = createMutation.isPending || updateMutation.isPending;

  const eligibleUsers = useMemo(() => (usersQuery.data?.items || [])
    .filter((user) => user.isActive && (user.role === "ADMIN" || user.role === "MANAGER"))
    .sort((a, b) => a.fullName.localeCompare(b.fullName)), [usersQuery.data?.items]);
  const activeBranches = useMemo(() => (branchesQuery.data || []).filter((branch) => branch.isActive), [branchesQuery.data]);
  const subscriptions = useMemo(() => subscriptionsQuery.data || [], [subscriptionsQuery.data]);
  const filteredSubscriptions = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return subscriptions;
    return subscriptions.filter((subscription) => [
      subscription.recipient.fullName,
      subscription.recipient.email,
      subscription.recipient.phone,
      subscription.branch?.name,
      subscription.branch?.code,
      formatFrequency(subscription.frequency),
      formatReportRange(subscription.reportRange),
    ].filter(Boolean).join(" ").toLowerCase().includes(normalized));
  }, [search, subscriptions]);

  const activeCount = subscriptions.filter((item) => item.isActive).length;
  const globalCount = subscriptions.filter((item) => item.scope === "GLOBAL").length;
  const branchCount = subscriptions.filter((item) => item.scope === "BRANCH").length;

  const closeModal = () => {
    if (savePending) return;
    setIsModalOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const openCreateModal = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, branchId: activeBranches[0]?.id || "" });
    setIsModalOpen(true);
  };

  const openEditModal = (subscription: ManagerReportSubscription) => {
    setEditing(subscription);
    setForm({
      recipientUserId: subscription.recipient.id,
      scope: subscription.scope,
      branchId: subscription.branch?.id || "",
      frequency: subscription.frequency,
      reportRange: subscription.reportRange,
      dayOfWeek: String(subscription.dayOfWeek || 1),
      dayOfMonth: String(subscription.dayOfMonth || 1),
      time: `${String(subscription.sendHour).padStart(2, "0")}:${String(subscription.sendMinute).padStart(2, "0")}`,
      timezone: subscription.timezone,
    });
    setIsModalOpen(true);
  };

  const validateForm = (): string | null => {
    const recipient = eligibleUsers.find((user) => user.id === form.recipientUserId);
    if (!recipient) return "Selecciona un destinatario activo con rol Administrador o Manager.";
    if (!hasValidWhatsApp(recipient)) return "El destinatario debe tener un número de WhatsApp válido.";
    if (form.scope === "BRANCH" && !form.branchId) return "Selecciona la sucursal del reporte.";
    if (!/^\d{2}:\d{2}$/.test(form.time)) return "Selecciona una hora válida.";
    const [hour, minute] = form.time.split(":").map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return "Selecciona una hora válida.";
    if (form.frequency === "WEEKLY" && (!Number.isInteger(Number(form.dayOfWeek)) || Number(form.dayOfWeek) < 1 || Number(form.dayOfWeek) > 7)) {
      return "Selecciona el día de envío semanal.";
    }
    if (form.frequency === "MONTHLY" && (!Number.isInteger(Number(form.dayOfMonth)) || Number(form.dayOfMonth) < 1 || Number(form.dayOfMonth) > 28)) {
      return "El día mensual debe estar entre 1 y 28.";
    }
    return null;
  };

  const toRequest = (): UpsertManagerReportSubscriptionInput => {
    const [sendHour, sendMinute] = form.time.split(":").map(Number);
    return {
      recipientUserId: form.recipientUserId,
      reportType: "QUOTE_PERFORMANCE",
      scope: form.scope,
      branchId: form.scope === "BRANCH" ? form.branchId : null,
      frequency: form.frequency,
      reportRange: form.reportRange,
      dayOfWeek: form.frequency === "WEEKLY" ? Number(form.dayOfWeek) : null,
      dayOfMonth: form.frequency === "MONTHLY" ? Number(form.dayOfMonth) : null,
      sendHour,
      sendMinute,
      timezone: form.timezone,
    };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validateForm();
    if (error) return void notifier.warning(error);
    try {
      if (editing) {
        await updateMutation.mutateAsync({ subscriptionId: editing.id, input: toRequest() });
        notifier.success("Suscripción de reporte actualizada.");
      } else {
        await createMutation.mutateAsync(toRequest());
        notifier.success("Suscripción de reporte creada.");
      }
      closeModal();
    } catch (mutationError) {
      notifier.error(mutationError instanceof Error ? mutationError.message : "No se pudo guardar la suscripción.");
    }
  };

  const handleSetActive = async (subscription: ManagerReportSubscription) => {
    try {
      await statusMutation.mutateAsync({ subscriptionId: subscription.id, isActive: !subscription.isActive });
      notifier.success(subscription.isActive ? "Suscripción desactivada." : "Suscripción activada.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
    }
  };

  const handleSendNow = async (subscription: ManagerReportSubscription) => {
    try {
      const result = await sendNowMutation.mutateAsync(subscription.id);
      const mode = result.deliveryMode === "TEMPLATE" ? "mediante la plantilla de WhatsApp" : "dentro de la ventana de 24 horas";
      notifier.success(`Reporte enviado a ${subscription.recipient.fullName} ${mode}.`);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo enviar el reporte.");
    }
  };

  if (!isAdmin) {
    return <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Esta vista es solo para usuarios con rol Administrador.</div>;
  }

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-linear-to-r from-slate-950 via-slate-900 to-slate-800 px-5 py-5 text-white">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-300 text-slate-950">
              <CalendarClock className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold">Reportes programados</h1>
              <p className="mt-1 max-w-2xl text-xs text-slate-300">Define quién recibirá el reporte de rendimiento de cotizaciones, qué información incluirá y cuándo debe enviarse.</p>
            </div>
          </div>
          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3 py-2 text-xs font-bold text-slate-950 transition hover:bg-amber-200">
            <Plus className="h-4 w-4" /> Nueva suscripción
          </button>
        </div>

        <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs text-amber-900">
          <span className="font-bold">Configuración preparada:</span> el envío automático se habilitará cuando se conecte el worker de reportes en el siguiente paso.
        </div>

        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <SummaryCard icon={<Send className="h-5 w-5" />} label="Suscripciones activas" value={activeCount} tone="amber" />
          <SummaryCard icon={<Globe2 className="h-5 w-5" />} label="Alcance global" value={globalCount} tone="slate" />
          <SummaryCard icon={<Building2 className="h-5 w-5" />} label="Por sucursal" value={branchCount} tone="sky" />
        </div>

        <div className="px-5 pb-5">
          <div className="relative mb-3 max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar destinatario, sucursal o frecuencia..." className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <TableHeader>Destinatario</TableHeader>
                  <TableHeader>Alcance</TableHeader>
                  <TableHeader>Frecuencia</TableHeader>
                  <TableHeader>Rango del reporte</TableHeader>
                  <TableHeader>Horario</TableHeader>
                  <TableHeader>Estado</TableHeader>
                  <TableHeader>Último cambio</TableHeader>
                  <TableHeader align="right">Acciones</TableHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {(subscriptionsQuery.isLoading || usersQuery.isLoading || branchesQuery.isLoading) && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Cargando configuración...</td></tr>
                )}
                {subscriptionsQuery.isError && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-sm text-rose-600">{subscriptionsQuery.error instanceof Error ? subscriptionsQuery.error.message : "No se pudo cargar la configuración."}</td></tr>
                )}
                {!subscriptionsQuery.isLoading && !subscriptionsQuery.isError && filteredSubscriptions.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-12 text-center"><CalendarClock className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="text-sm font-semibold text-slate-700">No hay suscripciones configuradas</p><p className="mt-1 text-xs text-slate-500">Crea la primera para preparar el envío de reportes gerenciales.</p></td></tr>
                )}
                {filteredSubscriptions.map((subscription) => {
                  const auditUser = subscription.updatedBy || subscription.createdBy;
                  return (
                    <tr key={subscription.id} className="hover:bg-slate-50/80">
                      <td className="px-3 py-3">
                        <p className="text-xs font-bold text-slate-900">{subscription.recipient.fullName}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{ROLE_LABELS[subscription.recipient.role]} · {subscription.recipient.email}</p>
                        <p className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${subscription.recipient.phone ? "text-emerald-700" : "text-rose-600"}`}><Smartphone className="h-3 w-3" />{formatPhone(subscription.recipient.phone)}</p>
                      </td>
                      <td className="px-3 py-3 text-xs text-slate-700">{subscription.scope === "GLOBAL" ? <span className="inline-flex items-center gap-1 font-semibold"><Globe2 className="h-3.5 w-3.5" />Todas las sucursales</span> : <span className="inline-flex items-center gap-1 font-semibold"><Building2 className="h-3.5 w-3.5" />{subscription.branch?.code} · {subscription.branch?.name}</span>}</td>
                      <td className="px-3 py-3 text-xs font-semibold text-slate-700">{formatFrequency(subscription.frequency)}</td>
                      <td className="px-3 py-3"><p className="text-xs font-semibold text-slate-800">{formatReportRange(subscription.reportRange)}</p><p className="mt-1 text-[10px] text-slate-500">Información incluida</p></td>
                      <td className="px-3 py-3"><p className="inline-flex items-center gap-1 text-xs font-semibold text-slate-800"><Clock3 className="h-3.5 w-3.5 text-amber-600" />{formatSchedule(subscription)}</p><p className="mt-1 text-[10px] text-slate-500">{TIMEZONES.find((item) => item.value === subscription.timezone)?.label || subscription.timezone}</p></td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${subscription.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{subscription.isActive ? "Activa" : "Inactiva"}</span></td>
                      <td className="px-3 py-3"><p className="text-xs font-semibold text-slate-700">{auditUser.fullName}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatAuditDate(subscription.updatedAt)}</p></td>
                      <td className="px-3 py-3 text-right"><div className="inline-flex items-center gap-1"><button type="button" onClick={() => void handleSendNow(subscription)} disabled={!subscription.isActive || sendNowMutation.isPending} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-amber-400 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-45" title={subscription.isActive ? "Generar y enviar el reporte ahora" : "Activa la suscripción para enviar"}>{sendNowMutation.isPending && sendNowMutation.variables === subscription.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Enviar ahora</button><button type="button" onClick={() => openEditModal(subscription)} disabled={sendNowMutation.isPending} className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50" title="Editar suscripción"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void handleSetActive(subscription)} disabled={statusMutation.isPending || sendNowMutation.isPending} className={`rounded-md border p-1.5 disabled:opacity-50 ${subscription.isActive ? "border-rose-300 text-rose-600 hover:bg-rose-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`} title={subscription.isActive ? "Desactivar suscripción" : "Activar suscripción"}>{statusMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-[1px]" onClick={closeModal} aria-label="Cerrar configuración" />
          <div className="relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">Reporte de rendimiento</p><h2 className="mt-1 text-lg font-bold text-slate-900">{editing ? "Editar suscripción" : "Nueva suscripción"}</h2><p className="mt-1 text-xs text-slate-500">El destinatario recibirá por WhatsApp el reporte correspondiente a su alcance.</p></div>
              <button type="button" onClick={closeModal} disabled={savePending} className="rounded-md p-1 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 px-5 py-4">
              <section className="space-y-3">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-700"><BarChart3 className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Destinatario y alcance</h3><p className="text-[11px] text-slate-500">Solo administradores y managers activos con WhatsApp válido.</p></div></div>
                <SelectField label="Destinatario" required value={form.recipientUserId} onChange={(value) => setForm((current) => ({ ...current, recipientUserId: value }))}>
                  <option value="">Seleccionar usuario...</option>
                  {eligibleUsers.map((user) => <option key={user.id} value={user.id} disabled={!hasValidWhatsApp(user)}>{user.fullName} · {ROLE_LABELS[user.role as "ADMIN" | "MANAGER"]} · {user.branch.name}{hasValidWhatsApp(user) ? "" : " · SIN WHATSAPP"}</option>)}
                </SelectField>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Alcance del reporte" required value={form.scope} onChange={(value) => setForm((current) => ({ ...current, scope: value as ManagerReportScope, branchId: value === "GLOBAL" ? "" : current.branchId }))}>
                    <option value="BRANCH">Una sucursal</option>
                    <option value="GLOBAL">Todas las sucursales</option>
                  </SelectField>
                  <SelectField label="Sucursal" required={form.scope === "BRANCH"} value={form.branchId} disabled={form.scope === "GLOBAL"} onChange={(value) => setForm((current) => ({ ...current, branchId: value }))}>
                    <option value="">Seleccionar sucursal...</option>
                    {activeBranches.map((branch) => <option key={branch.id} value={branch.id}>{branch.code} · {branch.name}</option>)}
                  </SelectField>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700"><CalendarClock className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Programación</h3><p className="text-[11px] text-slate-500">Configura el momento local en que debe enviarse el reporte.</p></div></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField label="Frecuencia" required value={form.frequency} onChange={(value) => setForm((current) => ({ ...current, frequency: value as ManagerReportFrequency }))}>
                    <option value="DAILY">Diario</option><option value="WEEKLY">Semanal</option><option value="MONTHLY">Mensual</option>
                  </SelectField>
                  {form.frequency === "WEEKLY" && <SelectField label="Día de la semana" required value={form.dayOfWeek} onChange={(value) => setForm((current) => ({ ...current, dayOfWeek: value }))}>{WEEK_DAYS.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</SelectField>}
                  {form.frequency === "MONTHLY" && <InputField label="Día del mes" required type="number" min={1} max={28} value={form.dayOfMonth} onChange={(value) => setForm((current) => ({ ...current, dayOfMonth: value }))} />}
                  {form.frequency === "DAILY" && <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"><p className="text-[10px] font-bold uppercase text-slate-500">Periodicidad</p><p className="mt-1 text-sm font-semibold text-slate-800">Todos los días</p></div>}
                  <InputField label="Hora de envío" required type="time" value={form.time} onChange={(value) => setForm((current) => ({ ...current, time: value }))} />
                  <SelectField label="Zona horaria" required value={form.timezone} onChange={(value) => setForm((current) => ({ ...current, timezone: value }))}>{TIMEZONES.map((timezone) => <option key={timezone.value} value={timezone.value}>{timezone.label}</option>)}</SelectField>
                </div>
              </section>

              <section className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-sky-100 text-sky-700"><BarChart3 className="h-4 w-4" /></span><div><h3 className="text-sm font-bold text-slate-900">Contenido del reporte</h3><p className="text-[11px] text-slate-500">Este rango es independiente de la frecuencia con la que se envía.</p></div></div>
                <SelectField label="Rango de información" required value={form.reportRange} onChange={(value) => setForm((current) => ({ ...current, reportRange: value as ManagerReportRange }))}>
                  {REPORT_RANGES.map((range) => <option key={range.value} value={range.value}>{range.label}</option>)}
                </SelectField>
                <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  {REPORT_RANGES.find((range) => range.value === form.reportRange)?.description}
                </div>
              </section>

              <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
                <button type="button" onClick={closeModal} disabled={savePending} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={savePending} className="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">{savePending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{editing ? "Guardar cambios" : "Crear suscripción"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone: "amber" | "slate" | "sky" }) => {
  const tones = { amber: "bg-amber-100 text-amber-800", slate: "bg-slate-100 text-slate-700", sky: "bg-sky-100 text-sky-700" };
  return <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4"><span className={`grid h-10 w-10 place-items-center rounded-lg ${tones[tone]}`}>{icon}</span><div><p className="text-2xl font-black text-slate-950">{value}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p></div></div>;
};

const TableHeader = ({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) => <th className={`whitespace-nowrap px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 ${align === "right" ? "text-right" : "text-left"}`}>{children}</th>;

interface SelectFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
  required?: boolean;
  disabled?: boolean;
}

const SelectField = ({ label, value, onChange, children, required = false, disabled = false }: SelectFieldProps) => <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span><select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500">{children}</select></label>;

interface InputFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type: "number" | "time";
  required?: boolean;
  min?: number;
  max?: number;
}

const InputField = ({ label, value, onChange, type, required = false, min, max }: InputFieldProps) => <label className="block"><span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}{required && <span className="ml-1 text-rose-500">*</span>}</span><input type={type} value={value} min={min} max={max} onChange={(event) => onChange(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" /></label>;
