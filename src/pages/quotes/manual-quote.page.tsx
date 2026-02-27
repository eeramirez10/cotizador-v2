import { FileCheck2, FileText, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
import { useClientsStore } from "../../store/clients/clients.store";
import { AddErpProductsModal } from "../../shared/components/modals/add-erp-products.modal";
import { useAuthStore } from "../../store/auth/auth.store";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";

const formatCurrency = (value: number, currency: "MXN" | "USD") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const getMarginVisual = (marginPct: number) => {
  if (marginPct < 0) {
    return {
      inputClass: "border-rose-400 bg-rose-50 text-rose-700",
      badgeClass: "bg-rose-100 text-rose-700",
      label: "Margen negativo",
    };
  }

  if (marginPct < 10) {
    return {
      inputClass: "border-amber-400 bg-amber-50 text-amber-700",
      badgeClass: "bg-amber-100 text-amber-700",
      label: "Margen bajo (<10%)",
    };
  }

  return {
    inputClass: "border-emerald-400 bg-emerald-50 text-emerald-700",
    badgeClass: "bg-emerald-100 text-emerald-700",
    label: "Margen saludable",
  };
};

export const ManualQuotePage = () => {
  const [openModal, setOpenModal] = useState(false);
  const [qtyDrafts, setQtyDrafts] = useState<Record<string, string>>({});
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const quoteIdFromQuery = searchParams.get("quoteId");

  const user = useAuthStore((state) => state.user);
  const clients = useClientsStore((state) => state.clients);
  const seedClients = useClientsStore((state) => state.seedClients);

  const draft = useManualQuoteStore((state) => state.draft);
  const initializeDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setCurrency = useManualQuoteStore((state) => state.setCurrency);
  const setExchangeRate = useManualQuoteStore((state) => state.setExchangeRate);
  const addProductFromErp = useManualQuoteStore((state) => state.addProductFromErp);
  const removeItem = useManualQuoteStore((state) => state.removeItem);
  const setItemQty = useManualQuoteStore((state) => state.setItemQty);
  const setItemMargin = useManualQuoteStore((state) => state.setItemMargin);
  const setItemUnitPrice = useManualQuoteStore((state) => state.setItemUnitPrice);
  const setItemDeliveryTime = useManualQuoteStore((state) => state.setItemDeliveryTime);
  const setClient = useManualQuoteStore((state) => state.setClient);
  const loadQuoteForEdit = useManualQuoteStore((state) => state.loadQuoteForEdit);
  const saveQuoteLocal = useManualQuoteStore((state) => state.saveQuoteLocal);
  const clearDraft = useManualQuoteStore((state) => state.clearDraft);
  const subtotal = useManualQuoteStore((state) => state.subtotal);
  const tax = useManualQuoteStore((state) => state.tax);
  const total = useManualQuoteStore((state) => state.total);

  useEffect(() => {
    seedClients();

    if (quoteIdFromQuery) {
      const loaded = loadQuoteForEdit(quoteIdFromQuery);

      if (!loaded) {
        window.alert("No se encontró la cotización para editar.");
        navigate("/quotes");
      }
      return;
    }

    clearDraft();
    initializeDraft(user);
  }, [clearDraft, initializeDraft, loadQuoteForEdit, navigate, quoteIdFromQuery, seedClients, user]);

  const quoteCurrency = draft.currency;

  const totalRequiresReview = useMemo(() => {
    return draft.items.filter((item) => item.requiresReview).length;
  }, [draft.items]);

  const commitQtyDraft = (itemId: string, rawValue: string, fallbackQty: number) => {
    const raw = (rawValue || `${fallbackQty}`).trim();
    const parsed = raw === "" ? 0 : Number(raw);

    if (Number.isFinite(parsed)) {
      const safeQty = Math.max(0, Math.floor(parsed));
      setItemQty(itemId, safeQty);
    }

    setQtyDrafts((state) => {
      const next = { ...state };
      delete next[itemId];
      return next;
    });
  };

  const commitPriceDraft = (itemId: string, rawValue: string, fallbackPrice: number) => {
    const raw = (rawValue || `${fallbackPrice}`).trim();
    const parsed = raw === "" ? 0 : Number(raw);

    if (Number.isFinite(parsed)) {
      const safePrice = Math.max(0, parsed);
      setItemUnitPrice(itemId, safePrice);
    }

    setPriceDrafts((state) => {
      const next = { ...state };
      delete next[itemId];
      return next;
    });
  };

  const validateBeforeSave = () => {
    if (!draft.client) {
      window.alert("Selecciona un cliente antes de guardar la cotización.");
      return false;
    }

    if (draft.items.length === 0) {
      window.alert("Agrega al menos una partida para guardar la cotización.");
      return false;
    }
    return true;
  };

  const handleSaveDraft = () => {
    if (!validateBeforeSave()) return;

    const quoteId = saveQuoteLocal("BORRADOR");
    clearDraft();
    window.alert(`Cotización ${quoteId} guardada como BORRADOR.`);
    navigate("/quotes");
  };

  const handleGenerateQuote = () => {
    if (!validateBeforeSave()) return;

    const quoteId = saveQuoteLocal("COTIZADA");
    clearDraft();
    window.alert(`Cotización ${quoteId} generada como COTIZADA.`);
    navigate("/quotes");
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{draft.savedQuoteId ? "Editar cotización" : "Cotización manual"}</h2>
          <p className="text-sm text-gray-500">
            Completa partidas, ajusta margen y precio con tipo de cambio. Costos ERP base en USD.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            <FileText className="h-4 w-4" />
            Guardar borrador
          </button>

          <button
            onClick={handleGenerateQuote}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700"
          >
            <FileCheck2 className="h-4 w-4" />
            Generar cotización
          </button>

          <button
            onClick={() => setOpenModal(true)}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            <Plus className="h-4 w-4" />
            Agregar productos
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 lg:grid-cols-4">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vendedor</p>
          <p className="text-sm text-gray-700">{draft.createdByName || `${user?.name ?? ""} ${user?.lastname ?? ""}`.trim()}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Sucursal</p>
          <p className="text-sm text-gray-700">{draft.branchName || user?.branch?.name || "-"}</p>
        </div>

        <div className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="client">
              Cliente
            </label>
            <NavLink to="/clients" className="text-xs font-semibold text-blue-600 hover:text-blue-800">
              Administrar clientes
            </NavLink>
          </div>

          <select
            id="client"
            value={draft.client?.id ?? ""}
            onChange={(event) => {
              const nextClientId = event.target.value;
              const nextClient = clients.find((client) => client.id === nextClientId) ?? null;
              setClient(nextClient);
            }}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="">Selecciona un cliente</option>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name} {client.lastname} - {client.companyName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="currency">
            Moneda cotización
          </label>
          <select
            id="currency"
            value={draft.currency}
            onChange={(event) => setCurrency(event.target.value as "MXN" | "USD")}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          >
            <option value="MXN">MXN</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase text-gray-500" htmlFor="exchangeRate">
            Tipo de cambio ({draft.exchangeRateSource})
          </label>
          <input
            id="exchangeRate"
            type="number"
            step="0.0001"
            min="0"
            value={draft.exchangeRate}
            onChange={(event) => setExchangeRate(Number(event.target.value || 0))}
            className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
          />
          <p className="mt-1 text-xs text-gray-500">Fecha TC: {draft.exchangeRateDate}</p>
        </div>
      </div>

      {draft.client && (
        <div className="mb-4 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
          <p className="text-xs font-semibold uppercase text-gray-500">Datos del cliente</p>
          <div className="mt-2 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            <p>
              <span className="font-semibold">Nombre:</span> {draft.client.name} {draft.client.lastname}
            </p>
            <p>
              <span className="font-semibold">Empresa:</span> {draft.client.companyName}
            </p>
            <p>
              <span className="font-semibold">WhatsApp:</span> {draft.client.whatsappPhone}
            </p>
            <p>
              <span className="font-semibold">Correo:</span> {draft.client.email}
            </p>
            <p>
              <span className="font-semibold">RFC:</span> {draft.client.rfc}
            </p>
            <p>
              <span className="font-semibold">Teléfono:</span> {draft.client.phone || "-"}
            </p>
          </div>
        </div>
      )}

      <div className="overflow-x-auto rounded-md border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código ERP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción ERP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Tiempo entrega</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cantidad</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo ERP</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Margen %</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Precio vendedor {quoteCurrency}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Subtotal {quoteCurrency}</th>
              <th className="px-4 py-2 text-left text-xs font-semibold uppercase text-gray-500">Revisión</th>
              <th className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-500">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {draft.items.length === 0 && (
              <tr>
                <td className="px-4 py-8 text-center text-sm text-gray-500" colSpan={13}>
                  No hay partidas. Usa "Agregar productos" para comenzar la cotización manual.
                </td>
              </tr>
            )}

            {draft.items.map((item) => {
              const marginVisual = getMarginVisual(item.marginPct);

              return (
                <tr key={item.id}>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{item.erpCode}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.ean}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.erpDescription}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">{item.unit}</td>
                  <td className="px-4 py-2 text-xs font-semibold text-gray-700">{item.stock}</td>
                  <td className="px-4 py-2">
                    {item.stock > 0 ? (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">
                        Inmediato
                      </span>
                    ) : (
                      <select
                        value={item.deliveryTime}
                        onChange={(event) => setItemDeliveryTime(item.id, event.target.value)}
                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                      >
                        <option value="1-2 semanas">1-2 semanas</option>
                        <option value="2-4 semanas">2-4 semanas</option>
                        <option value="4-6 semanas">4-6 semanas</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={qtyDrafts[item.id] ?? `${item.qty}`}
                      onChange={(event) =>
                        setQtyDrafts((state) => ({
                          ...state,
                          [item.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => commitQtyDraft(item.id, event.currentTarget.value, item.qty)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-20 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">{formatCurrency(item.costUsd, item.costCurrency)}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="-100"
                      step="0.01"
                      value={item.marginPct}
                      onChange={(event) => setItemMargin(item.id, Number(event.target.value || 0))}
                      className={`w-24 rounded-md border px-2 py-1 text-xs font-semibold ${marginVisual.inputClass}`}
                    />
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${marginVisual.badgeClass}`}>
                      {marginVisual.label}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={priceDrafts[item.id] ?? `${item.unitPrice}`}
                      onChange={(event) =>
                        setPriceDrafts((state) => ({
                          ...state,
                          [item.id]: event.target.value,
                        }))
                      }
                      onBlur={(event) => commitPriceDraft(item.id, event.currentTarget.value, item.unitPrice)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.currentTarget.blur();
                        }
                      }}
                      className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700"
                    />
                  </td>
                  <td className="px-4 py-2 text-xs font-semibold text-emerald-700">{formatCurrency(item.subtotal, quoteCurrency)}</td>
                  <td className="px-4 py-2">
                    {item.requiresReview ? (
                      <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">Revisar</span>
                    ) : (
                      <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">OK</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => removeItem(item.id)}
                      className="rounded-md border border-gray-300 p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Eliminar partida"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs text-gray-500">Partidas con revisión requerida: {totalRequiresReview}</p>

          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal(), quoteCurrency)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm text-gray-700">
            <span>IVA ({(draft.taxRate * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(tax(), quoteCurrency)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(total(), quoteCurrency)}</span>
          </div>
        </div>
      </div>

      <AddErpProductsModal
        open={openModal}
        onClose={() => setOpenModal(false)}
        onSelect={(product) => {
          addProductFromErp(product);
          setOpenModal(false);
        }}
      />
    </section>
  );
};
