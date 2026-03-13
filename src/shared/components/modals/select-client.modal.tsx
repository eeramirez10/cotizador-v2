import { Loader2, Search, UserPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type { ClientInput, Client } from "../../../modules/clients/types/client.types";
import type { ErpCustomer } from "../../../modules/clients/types/erp-customer.types";
import { useErpCustomerSearch } from "../../../queries/customers/use-erp-customer-search";
import { notifier } from "../../notifications/notifier";
import { useClientsStore } from "../../../store/clients/clients.store";

interface SelectClientModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (client: Client) => void;
  branchCode: string;
}

type SearchMode = "core" | "erp";

const EMPTY_FORM: ClientInput = {
  name: "",
  lastname: "",
  whatsappPhone: "",
  email: "",
  rfc: "",
  companyName: "",
  phone: "",
};

const splitDisplayName = (displayName: string): { name: string; lastname: string } => {
  const safe = displayName.trim();
  if (!safe) return { name: "", lastname: "." };

  const [first, ...rest] = safe.split(/\s+/);
  return {
    name: first,
    lastname: rest.join(" ") || ".",
  };
};

const toInputFromErp = (erpCustomer: ErpCustomer): ClientInput => {
  const split = splitDisplayName(erpCustomer.displayName);

  return {
    name: erpCustomer.firstName || split.name,
    lastname: erpCustomer.lastName || split.lastname,
    whatsappPhone: erpCustomer.whatsapp,
    email: erpCustomer.email || "",
    rfc: erpCustomer.taxId || "",
    companyName: erpCustomer.companyName || erpCustomer.displayName,
    phone: erpCustomer.phone || "",
  };
};

export const SelectClientModal = ({ open, onClose, onSelect, branchCode }: SelectClientModalProps) => {
  const clients = useClientsStore((state) => state.clients);
  const loadingCore = useClientsStore((state) => state.loading);
  const loadClients = useClientsStore((state) => state.loadClients);
  const addClient = useClientsStore((state) => state.addClient);

  const [mode, setMode] = useState<SearchMode>("core");
  const [term, setTerm] = useState("");
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<ClientInput>(EMPTY_FORM);

  const debouncedTerm = useDebouncedValue(term, 300);
  const erpEnabled = open && mode === "erp" && !!branchCode && debouncedTerm.trim().length >= 2;
  const { data: erpCustomers = [], isLoading: loadingErp, error: erpError } = useErpCustomerSearch(
    debouncedTerm,
    branchCode,
    erpEnabled
  );

  useEffect(() => {
    if (!open) return;
    if (mode !== "core") return;

    void loadClients({ search: debouncedTerm.trim() || undefined }).catch(() => {
      // handled by page notifications where needed
    });
  }, [debouncedTerm, loadClients, mode, open]);

  const filteredLocalClients = useMemo(() => {
    const normalized = debouncedTerm.trim().toLowerCase();
    if (!normalized) return clients;

    return clients.filter((client) => {
      const text = [
        client.name,
        client.lastname,
        client.companyName,
        client.whatsappPhone,
        client.email,
        client.rfc,
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(normalized);
    });
  }, [clients, debouncedTerm]);

  if (!open) return null;

  const handleSelectLocal = (client: Client) => {
    onSelect(client);
    onClose();
  };

  const handleSelectErp = async (erpCustomer: ErpCustomer) => {
    try {
      setCreating(true);
      const created = await addClient(toInputFromErp(erpCustomer));
      onSelect(created);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo anexar el cliente ERP.";
      notifier.error(message);
    } finally {
      setCreating(false);
    }
  };

  const handleCreateLocal = async () => {
    if (!createForm.name.trim()) {
      notifier.warning("El nombre es obligatorio.");
      return;
    }
    if (!createForm.lastname.trim()) {
      notifier.warning("El apellido es obligatorio.");
      return;
    }
    if (!createForm.whatsappPhone.trim()) {
      notifier.warning("El WhatsApp es obligatorio.");
      return;
    }

    try {
      setCreating(true);
      const created = await addClient(createForm);
      setCreateForm(EMPTY_FORM);
      onSelect(created);
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo crear el cliente.";
      notifier.error(message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative w-full max-w-6xl rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-700">Seleccionar cliente</h3>
            <p className="text-xs text-gray-500">Busca en clientes guardados, consulta ERP o crea cliente rápido.</p>
          </div>

          <button onClick={onClose} className="rounded-md p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 p-4 lg:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-1">
                <button
                  onClick={() => setMode("core")}
                  className={`rounded px-3 py-1 text-xs font-semibold ${mode === "core" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}
                >
                  Guardados
                </button>
                <button
                  onClick={() => setMode("erp")}
                  className={`rounded px-3 py-1 text-xs font-semibold ${mode === "erp" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600"}`}
                >
                  ERP
                </button>
              </div>

              <p className="text-xs text-gray-500">Sucursal: {branchCode || "No definida"}</p>
            </div>

            <div className="relative mb-3">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-800 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={mode === "erp" ? "Buscar por nombre, código, WhatsApp..." : "Buscar cliente guardado..."}
              />
            </div>

            <div className="max-h-[58vh] overflow-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Empresa</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">WhatsApp</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Correo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {mode === "core" && loadingCore && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-gray-500" colSpan={5}>
                        Cargando clientes...
                      </td>
                    </tr>
                  )}

                  {mode === "core" &&
                    !loadingCore &&
                    filteredLocalClients.map((client) => (
                      <tr key={client.id}>
                        <td className="px-3 py-2 text-xs text-gray-700">
                          {client.name} {client.lastname}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-700">{client.companyName || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{client.whatsappPhone}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{client.email || "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => handleSelectLocal(client)}
                            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
                          >
                            Seleccionar
                          </button>
                        </td>
                      </tr>
                    ))}

                  {mode === "core" && !loadingCore && filteredLocalClients.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-gray-500" colSpan={5}>
                        No se encontraron clientes guardados.
                      </td>
                    </tr>
                  )}

                  {mode === "erp" && loadingErp && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-gray-500" colSpan={5}>
                        <span className="inline-flex items-center gap-2 rounded border border-blue-100 bg-blue-50 px-3 py-1 text-blue-700">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Consultando ERP...
                        </span>
                      </td>
                    </tr>
                  )}

                  {mode === "erp" && !loadingErp && erpError && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-rose-600" colSpan={5}>
                        No se pudo consultar ERP. Verifica que el backend ERP esté activo.
                      </td>
                    </tr>
                  )}

                  {mode === "erp" && !loadingErp && !erpError && erpCustomers.length === 0 && (
                    <tr>
                      <td className="px-3 py-8 text-center text-sm text-gray-500" colSpan={5}>
                        {debouncedTerm.trim().length < 2
                          ? "Captura al menos 2 caracteres para buscar en ERP."
                          : "Sin resultados en ERP. Puedes crear cliente rápido."}
                      </td>
                    </tr>
                  )}

                  {mode === "erp" &&
                    !loadingErp &&
                    erpCustomers.map((customer) => (
                      <tr key={`${customer.code}-${customer.externalId}`}>
                        <td className="px-3 py-2 text-xs text-gray-700">{customer.displayName}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{customer.companyName || "-"}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{customer.whatsapp}</td>
                        <td className="px-3 py-2 text-xs text-gray-700">{customer.email || "-"}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              void handleSelectErp(customer);
                            }}
                            disabled={creating}
                            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-1 text-xs font-semibold text-white hover:from-emerald-600 hover:to-teal-700 disabled:opacity-60"
                          >
                            Anexar
                          </button>
                        </td>
                      </tr>
                    ))}

                  {mode === "erp" && erpError && !loadingErp && (
                    <tr>
                      <td className="px-3 py-6 text-center text-sm text-amber-700" colSpan={5}>
                        Endpoint ERP de clientes no disponible aún. El flujo de crear cliente rápido sigue activo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <aside className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <h4 className="text-xs font-semibold uppercase text-gray-600">Crear cliente rápido</h4>
            <p className="mb-3 text-xs text-gray-500">Mínimo: nombre, apellido y WhatsApp.</p>

            <div className="space-y-2">
              <Input label="Nombre" value={createForm.name} onChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))} />
              <Input
                label="Apellido"
                value={createForm.lastname}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, lastname: value }))}
              />
              <Input
                label="WhatsApp"
                value={createForm.whatsappPhone}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, whatsappPhone: value }))}
              />
              <Input label="Correo" value={createForm.email} onChange={(value) => setCreateForm((prev) => ({ ...prev, email: value }))} />
              <Input label="RFC" value={createForm.rfc} onChange={(value) => setCreateForm((prev) => ({ ...prev, rfc: value }))} />
              <Input
                label="Empresa"
                value={createForm.companyName}
                onChange={(value) => setCreateForm((prev) => ({ ...prev, companyName: value }))}
              />
              <Input label="Teléfono" value={createForm.phone ?? ""} onChange={(value) => setCreateForm((prev) => ({ ...prev, phone: value }))} />

              <button
                onClick={() => {
                  void handleCreateLocal();
                }}
                disabled={creating}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600 disabled:opacity-60"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                {creating ? "Guardando..." : "Crear y seleccionar"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const Input = ({ label, value, onChange }: InputProps) => {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase text-gray-500">{label}</label>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );
};
