import {
  Building2,
  Check,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import type {
  ErpWarehouse,
  UpsertErpWarehouseInput,
  WarehouseAccessMode,
} from "../../modules/erp-warehouses/services/erp-warehouses.service";
import { useBranchesList } from "../../queries/branches/use-branches";
import {
  useBranchWarehouseAccess,
  useCreateErpWarehouse,
  useErpWarehouses,
  useReplaceBranchWarehouseAccess,
  useReplaceUserWarehouseAccess,
  useUpdateErpWarehouse,
  useUserWarehouseAccess,
} from "../../queries/erp-warehouses/use-erp-warehouses";
import { useUsers } from "../../queries/users/use-users";
import { notifier } from "../../shared/notifications/notifier";

type View = "catalog" | "branches" | "users";

const viewFromParam = (value: string | null): View => {
  if (value === "branches" || value === "users") return value;
  return "catalog";
};

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message ? error.message : fallback;

export const ErpWarehousesPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = viewFromParam(searchParams.get("tab"));

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", next);
    if (next !== "branches") params.delete("branchId");
    if (next !== "users") params.delete("userId");
    setSearchParams(params);
  };

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="h-1.5 bg-[#fcce01]" />
        <div className="flex flex-col gap-3 px-5 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-600">Administración ERP</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Acceso a almacenes</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-500">
              Define qué almacenes alimentan las búsquedas de productos por sucursal y configura excepciones para vendedores específicos.
            </p>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900">
            Los cambios afectan las búsquedas ERP nuevas, no las cotizaciones existentes.
          </div>
        </div>
      </header>

      <nav className="flex gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-white p-1" aria-label="Configuración de almacenes">
        <TabButton active={view === "catalog"} onClick={() => setView("catalog")} icon={<Warehouse className="h-4 w-4" />}>
          Catálogo
        </TabButton>
        <TabButton active={view === "branches"} onClick={() => setView("branches")} icon={<Building2 className="h-4 w-4" />}>
          Por sucursal
        </TabButton>
        <TabButton active={view === "users"} onClick={() => setView("users")} icon={<UserRound className="h-4 w-4" />}>
          Por vendedor
        </TabButton>
      </nav>

      {view === "catalog" && <WarehouseCatalog />}
      {view === "branches" && <BranchAssignments initialBranchId={searchParams.get("branchId") || ""} />}
      {view === "users" && <UserAssignments initialUserId={searchParams.get("userId") || ""} />}
    </main>
  );
};

const TabButton = ({ active, onClick, icon, children }: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-w-max items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
      active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    }`}
  >
    {icon}{children}
  </button>
);

const WarehouseCatalog = () => {
  const query = useErpWarehouses();
  const createMutation = useCreateErpWarehouse();
  const updateMutation = useUpdateErpWarehouse();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<ErpWarehouse | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data || []).filter((item) => !term || `${item.code} ${item.name} ${item.companyCode || ""}`.toLowerCase().includes(term));
  }, [query.data, search]);

  const handleDeactivate = async (warehouse: ErpWarehouse) => {
    const loadingId = notifier.loading("Actualizando almacén...");
    try {
      await updateMutation.mutateAsync({
        id: warehouse.id,
        input: { name: warehouse.name, companyCode: warehouse.companyCode, isActive: !warehouse.isActive },
      });
      if (loadingId !== undefined) notifier.update(loadingId, "success", warehouse.isActive ? "Almacén desactivado." : "Almacén activado.");
    } catch (error) {
      if (loadingId !== undefined) notifier.update(loadingId, "error", errorMessage(error, "No se pudo actualizar."));
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código o nombre" className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
        </div>
        <button type="button" onClick={() => { setEditing(null); setModalOpen(true); }} className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
          <Plus className="h-4 w-4" /> Agregar almacén
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50"><tr>
            {['Código', 'Nombre ERP', 'Compañía', 'Estado', 'Acciones'].map((label) => <th key={label} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500">{label}</th>)}
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {query.isLoading && <LoadingRow colSpan={5} />}
            {!query.isLoading && rows.map((warehouse) => (
              <tr key={warehouse.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-bold text-slate-900">{warehouse.code}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{warehouse.name}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{warehouse.companyCode || '-'}</td>
                <td className="px-4 py-3"><Status active={warehouse.isActive} /></td>
                <td className="px-4 py-3"><div className="flex gap-2">
                  <button type="button" onClick={() => { setEditing(warehouse); setModalOpen(true); }} className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><Pencil className="h-3.5 w-3.5" /> Editar</button>
                  <button type="button" disabled={updateMutation.isPending} onClick={() => void handleDeactivate(warehouse)} className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${warehouse.isActive ? "border-red-200 text-red-700 hover:bg-red-50" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"}`}>{warehouse.isActive ? 'Desactivar' : 'Activar'}</button>
                </div></td>
              </tr>
            ))}
            {!query.isLoading && rows.length === 0 && <EmptyRow colSpan={5} text="No hay almacenes que coincidan con la búsqueda." />}
          </tbody>
        </table>
      </div>

      {modalOpen && <WarehouseModal
        warehouse={editing}
        pending={createMutation.isPending || updateMutation.isPending}
        onClose={() => setModalOpen(false)}
        onSave={async (input) => {
          const loadingId = notifier.loading(editing ? "Guardando cambios..." : "Creando almacén...");
          try {
            if (editing) await updateMutation.mutateAsync({ id: editing.id, input: { ...input, isActive: editing.isActive } });
            else await createMutation.mutateAsync(input);
            if (loadingId !== undefined) notifier.update(loadingId, "success", editing ? "Almacén actualizado." : "Almacén creado.");
            setModalOpen(false);
          } catch (error) {
            if (loadingId !== undefined) notifier.update(loadingId, "error", errorMessage(error, "No se pudo guardar."));
          }
        }}
      />}
    </section>
  );
};

const BranchAssignments = ({ initialBranchId }: { initialBranchId: string }) => {
  const branches = useBranchesList();
  const warehouses = useErpWarehouses();
  const [branchId, setBranchId] = useState(initialBranchId);
  const activeBranches = (branches.data || []).filter((item) => item.isActive);
  const selectedBranchId = branchId || activeBranches[0]?.id || "";
  const access = useBranchWarehouseAccess(selectedBranchId);

  return (
    <AssignmentLayout title="Almacenes por sucursal" description="Todos los vendedores de la sucursal heredan estos almacenes, salvo que tengan una excepción individual.">
      <SelectField label="Sucursal" value={selectedBranchId} onChange={setBranchId} options={activeBranches.map((item) => ({ value: item.id, label: `${item.code} · ${item.name}` }))} />
      {access.isLoading || !access.data ? <LoadingPanel /> : (
        <BranchAccessEditor
          key={`${selectedBranchId}-${access.dataUpdatedAt}`}
          branchId={selectedBranchId}
          warehouses={warehouses.data || []}
          initialCodes={access.data.warehouses.map((item) => item.code)}
        />
      )}
    </AssignmentLayout>
  );
};

const BranchAccessEditor = ({ branchId, warehouses, initialCodes }: { branchId: string; warehouses: ErpWarehouse[]; initialCodes: string[] }) => {
  const save = useReplaceBranchWarehouseAccess();
  const [selected, setSelected] = useState(initialCodes);
  const handleSave = async () => {
    if (!branchId || selected.length === 0) return notifier.warning("Selecciona al menos un almacén para la sucursal.");
    const loadingId = notifier.loading("Guardando almacenes de la sucursal...");
    try {
      await save.mutateAsync({ branchId, warehouseCodes: selected });
      if (loadingId !== undefined) notifier.update(loadingId, "success", "Configuración de sucursal guardada.");
    } catch (error) {
      if (loadingId !== undefined) notifier.update(loadingId, "error", errorMessage(error, "No se pudo guardar."));
    }
  };
  return <><WarehousePicker warehouses={warehouses} selected={selected} onChange={setSelected} /><div className="flex justify-end border-t border-slate-200 pt-4"><SaveButton pending={save.isPending} onClick={() => void handleSave()} /></div></>;
};

const UserAssignments = ({ initialUserId }: { initialUserId: string }) => {
  const users = useUsers({ page: 1, pageSize: 100 });
  const warehouses = useErpWarehouses();
  const sellers = useMemo(() => (users.data?.items || []).filter((item) => item.role === "SELLER" && item.isActive), [users.data]);
  const [userId, setUserId] = useState(initialUserId);
  const selectedUserId = userId || sellers[0]?.id || "";
  const access = useUserWarehouseAccess(selectedUserId);

  return (
    <AssignmentLayout title="Excepciones por vendedor" description="Elige si el vendedor hereda los almacenes de su sucursal, suma almacenes adicionales o usa únicamente una selección propia.">
      <SelectField label="Vendedor" value={selectedUserId} onChange={setUserId} options={sellers.map((item) => ({ value: item.id, label: `${item.fullName} · ${item.branch.code} ${item.branch.name}` }))} />
      {access.isLoading || !access.data ? <LoadingPanel /> : (
        <UserAccessEditor
          key={`${selectedUserId}-${access.dataUpdatedAt}`}
          userId={selectedUserId}
          warehouses={warehouses.data || []}
          branchWarehouses={access.data.branchWarehouses}
          initialMode={access.data.accessMode}
          initialCodes={access.data.userWarehouses.map((item) => item.code)}
        />
      )}
    </AssignmentLayout>
  );
};

const UserAccessEditor = ({ userId, warehouses, branchWarehouses, initialMode, initialCodes }: {
  userId: string;
  warehouses: ErpWarehouse[];
  branchWarehouses: ErpWarehouse[];
  initialMode: WarehouseAccessMode;
  initialCodes: string[];
}) => {
  const save = useReplaceUserWarehouseAccess();
  const [mode, setMode] = useState<WarehouseAccessMode>(initialMode);
  const [selected, setSelected] = useState(initialCodes);
  const effectivePreview = useMemo(() => {
    const selectedItems = warehouses.filter((item) => selected.includes(item.code));
    if (mode === "INHERIT") return branchWarehouses;
    if (mode === "OVERRIDE") return selectedItems;

    const unique = new Map<string, ErpWarehouse>();
    [...branchWarehouses, ...selectedItems].forEach((item) => unique.set(item.code, item));
    return Array.from(unique.values()).sort((left, right) => left.code.localeCompare(right.code));
  }, [branchWarehouses, mode, selected, warehouses]);

  const handleMode = (next: WarehouseAccessMode) => {
    setMode(next);
    if (next === "INHERIT") setSelected([]);
  };
  const handleSave = async () => {
    if (!userId) return notifier.warning("Selecciona un vendedor.");
    if (mode !== "INHERIT" && selected.length === 0) return notifier.warning("Selecciona al menos un almacén individual.");
    const loadingId = notifier.loading("Guardando acceso del vendedor...");
    try {
      await save.mutateAsync({ userId, accessMode: mode, warehouseCodes: mode === "INHERIT" ? [] : selected });
      if (loadingId !== undefined) notifier.update(loadingId, "success", "Acceso del vendedor actualizado.");
    } catch (error) {
      if (loadingId !== undefined) notifier.update(loadingId, "error", errorMessage(error, "No se pudo guardar."));
    }
  };

  return <>
        <div className="grid gap-3 md:grid-cols-3">
          <ModeCard active={mode === "INHERIT"} title="Heredar" text="Usa exactamente los almacenes de su sucursal." onClick={() => handleMode("INHERIT")} />
          <ModeCard active={mode === "ADDITIVE"} title="Sumar" text="Conserva los de su sucursal y agrega otros." onClick={() => handleMode("ADDITIVE")} />
          <ModeCard active={mode === "OVERRIDE"} title="Sustituir" text="Ignora la sucursal y usa solo la selección individual." onClick={() => handleMode("OVERRIDE")} />
        </div>
        {mode !== "INHERIT" && <WarehousePicker warehouses={warehouses} selected={selected} onChange={setSelected} />}
        <EffectiveAccess warehouses={effectivePreview} />
      <div className="flex justify-end border-t border-slate-200 pt-4"><SaveButton pending={save.isPending} onClick={() => void handleSave()} /></div>
    </>;
};

const AssignmentLayout = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
  <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-5">
    <div><h2 className="text-lg font-bold text-slate-900">{title}</h2><p className="mt-1 text-sm text-slate-500">{description}</p></div>
    {children}
  </section>
);

const SelectField = ({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) => (
  <label className="block max-w-xl"><span className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-600">{label}</span><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"><option value="">Selecciona una opción</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
);

const WarehousePicker = ({ warehouses, selected, onChange }: { warehouses: ErpWarehouse[]; selected: string[]; onChange: (codes: string[]) => void }) => {
  const active = warehouses.filter((item) => item.isActive);
  const toggle = (code: string) => onChange(selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code]);
  return <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold text-slate-800">Almacenes disponibles</h3><span className="text-xs text-slate-500">{selected.length} seleccionados</span></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{active.map((warehouse) => { const checked = selected.includes(warehouse.code); return <button key={warehouse.id} type="button" onClick={() => toggle(warehouse.code)} className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${checked ? "border-amber-400 bg-amber-50" : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"}`}><span className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${checked ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white"}`}>{checked && <Check className="h-3.5 w-3.5" />}</span><span><span className="block text-sm font-bold text-slate-900">{warehouse.code} · {warehouse.name}</span><span className="text-xs text-slate-500">Compañía {warehouse.companyCode || '-'}</span></span></button>; })}</div></div>;
};

const EffectiveAccess = ({ warehouses }: { warehouses: ErpWarehouse[] }) => (
  <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-emerald-800">Acceso efectivo actual</p><div className="mt-2 flex flex-wrap gap-2">{warehouses.length ? warehouses.map((item) => <span key={item.id} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">{item.code} · {item.name}</span>) : <span className="text-sm text-emerald-800">Sin almacenes efectivos.</span>}</div></div>
);

const ModeCard = ({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) => <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left ${active ? "border-amber-400 bg-amber-50 ring-2 ring-amber-100" : "border-slate-200 hover:bg-slate-50"}`}><span className="flex items-center justify-between text-sm font-bold text-slate-900">{title}{active && <Check className="h-4 w-4" />}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{text}</span></button>;

const SaveButton = ({ pending, onClick }: { pending: boolean; onClick: () => void }) => <button type="button" disabled={pending} onClick={onClick} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar configuración</button>;
const Status = ({ active }: { active: boolean }) => <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{active ? 'Activo' : 'Inactivo'}</span>;
const LoadingPanel = () => <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando configuración...</div>;
const LoadingRow = ({ colSpan }: { colSpan: number }) => <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Cargando...</td></tr>;
const EmptyRow = ({ colSpan, text }: { colSpan: number; text: string }) => <tr><td colSpan={colSpan} className="px-4 py-10 text-center text-sm text-slate-500">{text}</td></tr>;

const WarehouseModal = ({ warehouse, pending, onClose, onSave }: { warehouse: ErpWarehouse | null; pending: boolean; onClose: () => void; onSave: (input: UpsertErpWarehouseInput) => Promise<void> }) => {
  const [code, setCode] = useState(warehouse?.code || "");
  const [name, setName] = useState(warehouse?.name || "");
  const [companyCode, setCompanyCode] = useState(warehouse?.companyCode || "");
  const submit = (event: React.FormEvent) => { event.preventDefault(); if (!code.trim() || !name.trim()) return notifier.warning("Código y nombre son obligatorios."); void onSave({ code: code.trim(), name: name.trim(), companyCode: companyCode.trim() || null }); };
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Cerrar" /><div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl"><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">{warehouse ? 'Editar almacén' : 'Agregar almacén'}</h2><p className="text-xs text-slate-500">Los datos deben coincidir con el catálogo del ERP.</p></div><button type="button" onClick={onClose} disabled={pending} className="rounded-md p-1 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><form onSubmit={submit} className="space-y-4 p-5"><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Código ERP *</span><input value={code} disabled={Boolean(warehouse)} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 4))} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100" /></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Nombre *</span><input value={name} onChange={(event) => setName(event.target.value.toUpperCase())} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><label className="block"><span className="mb-1 block text-xs font-bold text-slate-600">Código de compañía</span><input value={companyCode} onChange={(event) => setCompanyCode(event.target.value)} className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" /></label><div className="flex justify-end gap-2 border-t border-slate-200 pt-4"><button type="button" onClick={onClose} disabled={pending} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Cancelar</button><button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{pending && <Loader2 className="h-4 w-4 animate-spin" />} Guardar</button></div></form></div></div>;
};
