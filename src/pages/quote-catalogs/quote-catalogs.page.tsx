import { Loader2, Pencil, Plus, Power, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { QuoteCatalogOption, QuoteCatalogType } from "../../modules/quote-catalogs/services/quote-catalogs.service";
import { useCreateQuoteCatalogOption, useDeactivateQuoteCatalogOption, useManagedQuoteCatalogs, useQuoteCatalogs, useSuggestQuoteCatalogCode, useUpdateQuoteCatalogOption } from "../../queries/quote-catalogs/use-quote-catalogs";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

const TYPES: Array<{ value: QuoteCatalogType; label: string; needsValue?: boolean; needsNumber?: boolean; reason?: boolean }> = [
  { value: "VALIDITY_DAYS", label: "Vigencias", needsNumber: true },
  { value: "PAYMENT_TERMS", label: "Condiciones de pago", needsValue: true },
  { value: "COMMERCIAL_CONDITIONS", label: "Condiciones comerciales", needsValue: true },
  { value: "DELIVERY_TIME", label: "Tiempos de entrega", needsValue: true },
  { value: "REVISION_REASON", label: "Motivos de revisión", reason: true },
  { value: "REJECTION_REASON", label: "Motivos de rechazo", reason: true },
  { value: "CANCELLATION_REASON", label: "Motivos de cancelación", reason: true },
  { value: "APPROVAL_RETURN_REASON", label: "Motivos de devolución", reason: true },
];
const emptyForm = (type: QuoteCatalogType, sortOrder = 0) => ({ type, code: "", label: "", value: "", numericValue: "", requiresComment: false, sortOrder: String(sortOrder), isActive: true });

export const QuoteCatalogsPage = () => {
  const user = useAuthStore((state) => state.user);
  const isAdmin = (user?.role || "").toLowerCase() === "admin";
  const [type, setType] = useState<QuoteCatalogType>("VALIDITY_DAYS");
  const [editing, setEditing] = useState<QuoteCatalogOption | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm("VALIDITY_DAYS"));
  const query = useManagedQuoteCatalogs();
  const availableQuery = useQuoteCatalogs(type);
  const create = useCreateQuoteCatalogOption();
  const update = useUpdateQuoteCatalogOption();
  const deactivate = useDeactivateQuoteCatalogOption();
  const suggestCode = useSuggestQuoteCatalogCode();
  const selected = TYPES.find((item) => item.value === type)!;
  const rows = useMemo(() => (query.data || []).filter((option) => option.type === type), [query.data, type]);
  const pending = create.isPending || update.isPending || suggestCode.isPending;
  const canManage = (option: QuoteCatalogOption) => isAdmin || option.branchId === user?.branchId;
  const openCreate = () => {
    const existingOrders = [
      ...rows.map((option) => option.sortOrder),
      ...(availableQuery.data || []).map((option) => option.sortOrder),
    ];
    const nextOrder = Math.max(0, ...existingOrders) + 10;
    setEditing(null);
    setForm(emptyForm(type, nextOrder));
    setIsModalOpen(true);
  };
  const openEdit = (option: QuoteCatalogOption) => { setEditing(option); setForm({ type: option.type, code: option.code, label: option.label, value: option.value || "", numericValue: option.numericValue === null ? "" : String(option.numericValue), requiresComment: option.requiresComment, sortOrder: String(option.sortOrder), isActive: option.isActive }); setIsModalOpen(true); };
  const close = () => { setIsModalOpen(false); setEditing(null); setForm(emptyForm(type)); };
  const generateInternalCode = async () => {
    const label = form.label.trim();
    if (!label) return notifier.warning("Escribe primero el nombre visible.");
    try {
      const code = await suggestCode.mutateAsync({
        type: form.type,
        label,
        existingCodes: rows.map((option) => option.code),
      });
      setForm((current) => ({ ...current, code }));
      notifier.success("Código interno generado con IA.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo generar el código interno.");
    }
  };
  const submit = async () => {
    if (!form.label.trim()) return notifier.warning("Indica el nombre de la opción.");
    if (!editing && !form.code.trim()) return notifier.warning("Genera el código interno antes de guardar.");
    const input = { type: form.type, code: form.code || undefined, label: form.label.trim(), value: selected.needsValue ? form.value.trim() || form.label.trim() : null, numericValue: selected.needsNumber ? Number(form.numericValue) : null, requiresComment: selected.reason && form.requiresComment, sortOrder: Number(form.sortOrder) || 0, isActive: form.isActive };
    try { if (editing) await update.mutateAsync({ id: editing.id, input }); else await create.mutateAsync(input); notifier.success(editing ? "Opción actualizada." : "Opción creada."); close(); } catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo guardar."); }
  };
  return (
    <section className="p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Catálogos de cotización</h1>
          <p className="mt-1 text-sm text-gray-500">Administra las opciones disponibles para tu sucursal. Los cambios no alteran cotizaciones históricas.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
          <Plus className="h-4 w-4" />Agregar opción
        </button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {TYPES.map((item) => (
          <button key={item.value} onClick={() => { setType(item.value); close(); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${type === item.value ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"}`}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr><th className="px-4 py-3">Opción</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3">Alcance</th><th className="px-4 py-3">Orden</th><th className="px-4 py-3">Estado</th><th className="px-4 py-3 text-right">Acciones</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {query.isLoading && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando catálogos...</td></tr>}
            {query.isError && <tr><td colSpan={6} className="px-4 py-10 text-center text-rose-600"><p>No se pudieron cargar las opciones del catálogo.</p><button type="button" onClick={() => void query.refetch()} className="mt-2 text-xs font-semibold underline underline-offset-2">Volver a intentar</button></td></tr>}
            {!query.isLoading && !query.isError && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-500">No hay opciones registradas.</td></tr>}
            {rows.map((option) => (
              <tr key={option.id}>
                <td className="px-4 py-3"><p className="font-semibold text-gray-800">{option.label}</p><p className="text-xs text-gray-400">{option.code}</p></td>
                <td className="max-w-xl px-4 py-3 text-gray-600">{option.numericValue ?? option.value ?? "-"}</td>
                <td className="px-4 py-3 text-xs font-semibold text-gray-500">{option.scope === "GLOBAL" ? "Global" : "Sucursal"}</td>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{option.sortOrder}</td>
                <td className="px-4 py-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${option.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-600"}`}>{option.isActive ? "Activa" : "Inactiva"}</span></td>
                <td className="px-4 py-3 text-right">{canManage(option) && <><button onClick={() => openEdit(option)} className="mr-2 rounded-md border border-gray-300 p-2 text-gray-600 hover:bg-gray-50" title="Editar"><Pencil className="h-4 w-4" /></button>{option.isActive && <button onClick={() => void deactivate.mutateAsync(option.id).then(() => notifier.success("Opción desactivada.")).catch((error: unknown) => notifier.error(error instanceof Error ? error.message : "No se pudo desactivar."))} className="rounded-md border border-rose-200 p-2 text-rose-600 hover:bg-rose-50" title="Desactivar"><Power className="h-4 w-4" /></button>}</>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div><h2 className="text-lg font-bold text-gray-900">{editing ? "Editar opción" : "Nueva opción"}</h2><p className="text-sm text-gray-500">{selected.label}</p></div>
              <button onClick={close} className="rounded-md p-1 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-semibold uppercase text-gray-500">Nombre visible</label>
                <input value={form.label} onChange={(event) => setForm({ ...form, label: event.target.value, code: editing ? form.code : "" })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" placeholder="Ej. Crédito 90 días" />
              </div>
              {selected.needsNumber && <div><label className="text-xs font-semibold uppercase text-gray-500">Días de vigencia</label><input type="number" min="1" value={form.numericValue} onChange={(event) => setForm({ ...form, numericValue: event.target.value })} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>}
              {selected.needsValue && <div><label className="text-xs font-semibold uppercase text-gray-500">Texto que se guardará en la cotización</label><textarea value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} className="mt-1 min-h-24 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>}
              {selected.reason && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.requiresComment} onChange={(event) => setForm({ ...form, requiresComment: event.target.checked })} />Requerir comentario al elegir este motivo</label>}
              <div><label className="text-xs font-semibold uppercase text-gray-500">Orden</label><input type="number" min="0" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} className="mt-1 w-32 rounded-md border border-gray-300 px-3 py-2 text-sm" /></div>
              {editing && <label className="flex items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} />Opción activa</label>}

              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div><label className="text-xs font-semibold uppercase text-gray-500">Código interno</label><p className="mt-0.5 text-xs text-gray-400">Identificador técnico en inglés.</p></div>
                  {!editing && <button type="button" onClick={() => void generateInternalCode()} disabled={!form.label.trim() || suggestCode.isPending} className="inline-flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50">{suggestCode.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}Generar código interno</button>}
                </div>
                <input readOnly value={form.code} className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-sm uppercase text-gray-700" placeholder="La IA generará el código aquí" />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={close} className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700">Cancelar</button>
              <button disabled={pending || (!editing && !form.code.trim())} onClick={() => void submit()} className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60">{(create.isPending || update.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
