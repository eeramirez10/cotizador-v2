import { CheckSquare2, Loader2, PackageSearch, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuoteCatalogs } from "../../../queries/quote-catalogs/use-quote-catalogs";
import { useSuppliers } from "../../../queries/procurement/use-purchase-requisitions";
import type {
  ManualQuoteItem,
  ProcurementPrequoteUpdate,
  QuoteCurrency,
} from "../../../store/quote/manual-quote.store";

interface SellerProcurementBulkPrequoteModalProps {
  items: ManualQuoteItem[];
  onClose: () => void;
  onSave: (updates: ProcurementPrequoteUpdate[]) => void;
}

interface ItemForm {
  unitCost: string;
  currency: QuoteCurrency;
  brand: string;
}

const MANUAL_SUPPLIER = "__MANUAL__";
const optionValue = (option: { value: string | null; label: string }) => option.value || option.label;

const hasCompleteData = (item: ManualQuoteItem): boolean => Boolean(
  item.sellerSupplierName.trim()
  && item.sellerQuotedUnitCost !== null
  && item.sellerQuotedUnitCost > 0
  && item.sellerDeliveryState.trim()
  && item.sellerSupplierDeliveryTime.trim()
);

const commonValue = (values: string[]): string => {
  if (values.length === 0) return "";
  return values.every((value) => value === values[0]) ? values[0] : "";
};

export const SellerProcurementBulkPrequoteModal = ({
  items,
  onClose,
  onSave,
}: SellerProcurementBulkPrequoteModalProps) => {
  const suppliers = useSuppliers(true);
  const brands = useQuoteCatalogs("PURCHASE_BRAND");
  const restrictions = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStates = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimes = useQuoteCatalogs("DELIVERY_TIME");
  const initiallySelectedItems = useMemo(() => {
    const incomplete = items.filter((item) => !hasCompleteData(item));
    return incomplete.length > 0 ? incomplete : items;
  }, [items]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(initiallySelectedItems.map((item) => item.id))
  );
  const initialSupplierIds = initiallySelectedItems.map((item) => item.sellerSupplierId || "");
  const commonSupplierId = commonValue(initialSupplierIds);
  const [supplierSelection, setSupplierSelection] = useState(commonSupplierId || MANUAL_SUPPLIER);
  const [supplierName, setSupplierName] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerSupplierName))
  );
  const [deliveryState, setDeliveryState] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerDeliveryState))
  );
  const [supplierDeliveryTime, setSupplierDeliveryTime] = useState(
    commonValue(initiallySelectedItems.map((item) => item.sellerSupplierDeliveryTime))
  );
  const [originRestrictions, setOriginRestrictions] = useState<string[]>(() => {
    if (initiallySelectedItems.length === 0) return [];
    const first = initiallySelectedItems[0].sellerOriginRestrictions;
    return initiallySelectedItems.every(
      (item) => JSON.stringify(item.sellerOriginRestrictions) === JSON.stringify(first)
    ) ? first : [];
  });
  const [itemForms, setItemForms] = useState<Record<string, ItemForm>>(() =>
    Object.fromEntries(items.map((item) => [item.id, {
      unitCost: item.sellerQuotedUnitCost === null ? "" : String(item.sellerQuotedUnitCost),
      currency: item.sellerQuotedCurrency || "MXN",
      brand: item.sellerQuotedBrand || "",
    }]))
  );
  const [error, setError] = useState("");
  const supplierOptions = suppliers.data || [];
  const noRestrictionValue = useMemo(() => {
    const option = (restrictions.data || []).find((entry) => entry.code === "NO_RESTRICTION");
    return option ? optionValue(option) : "SIN RESTRICCIÓN";
  }, [restrictions.data]);
  const allSelected = items.length > 0 && selectedIds.size === items.length;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
    setError("");
  };

  const toggleAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((item) => item.id)));
    setError("");
  };

  const toggleRestriction = (value: string) => {
    setOriginRestrictions((current) => {
      if (current.includes(value)) return current.filter((entry) => entry !== value);
      if (value === noRestrictionValue) return [value];
      return [...current.filter((entry) => entry !== noRestrictionValue), value];
    });
  };

  const updateItemForm = (itemId: string, data: Partial<ItemForm>) => {
    setItemForms((current) => ({
      ...current,
      [itemId]: { ...current[itemId], ...data },
    }));
    setError("");
  };

  const submit = () => {
    const selectedItems = items.filter((item) => selectedIds.has(item.id));
    const normalizedSupplierName = supplierName.trim();
    if (selectedItems.length === 0) return setError("Selecciona al menos una partida.");
    if (!normalizedSupplierName) return setError("Selecciona o escribe el proveedor que cotizó las partidas.");
    if (!deliveryState) return setError("Selecciona el estado donde se entregará el material.");
    if (!supplierDeliveryTime) return setError("Selecciona el tiempo de entrega ofrecido por el proveedor.");

    const invalidCost = selectedItems.find((item) => {
      const cost = Number(itemForms[item.id]?.unitCost);
      return !Number.isFinite(cost) || cost <= 0;
    });
    if (invalidCost) {
      return setError(`Captura un costo mayor a cero para la partida ${invalidCost.erpCode || invalidCost.id}.`);
    }

    onSave(selectedItems.map((item) => {
      const form = itemForms[item.id];
      return {
        itemId: item.id,
        data: {
          sellerSupplierId: supplierSelection === MANUAL_SUPPLIER ? null : supplierSelection,
          sellerSupplierName: normalizedSupplierName,
          sellerQuotedUnitCost: Number(form.unitCost),
          sellerQuotedCurrency: form.currency,
          sellerQuotedBrand: form.brand,
          sellerOriginRestrictions: originRestrictions,
          sellerDeliveryState: deliveryState,
          sellerSupplierDeliveryTime: supplierDeliveryTime,
          purchaseStandard: item.purchaseStandard,
          purchaseDiameter: item.purchaseDiameter,
          purchaseThickness: item.purchaseThickness,
          purchaseBore: item.purchaseBore,
        },
      };
    }));
  };

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
  const tableInputClass = "w-full min-w-24 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
  const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";
  const catalogsLoading = suppliers.isLoading
    || brands.isLoading
    || restrictions.isLoading
    || deliveryStates.isLoading
    || deliveryTimes.isLoading;

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="bulk-procurement-prequote-title">
      <div className="absolute inset-0 bg-slate-950/55" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><CheckSquare2 className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Información para Compras</p>
              <h2 id="bulk-procurement-prequote-title" className="text-base font-semibold text-slate-900">Completar compra en lote</h2>
              <p className="mt-1 text-xs text-slate-500">Asigna un proveedor a una o varias partidas locales o sin stock.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <label className={labelClass}>Proveedor *
                <select value={supplierSelection} onChange={(event) => {
                  const id = event.target.value;
                  setSupplierSelection(id);
                  const supplier = supplierOptions.find((entry) => entry.id === id);
                  setSupplierName(supplier?.name || "");
                }} className={inputClass}>
                  <option value={MANUAL_SUPPLIER}>Otro / no registrado</option>
                  {supplierOptions.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</option>)}
                </select>
              </label>
              <label className={labelClass}>Nombre del proveedor *
                <input value={supplierName} onChange={(event) => {
                  setSupplierName(event.target.value);
                  if (supplierSelection !== MANUAL_SUPPLIER) setSupplierSelection(MANUAL_SUPPLIER);
                }} className={inputClass} placeholder="Proveedor que cotizó" />
              </label>
              <label className={labelClass}>Estado de entrega *
                <select value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} className={inputClass}>
                  <option value="">Seleccionar estado</option>
                  {(deliveryStates.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                </select>
              </label>
              <label className={labelClass}>Tiempo ofrecido *
                <select value={supplierDeliveryTime} onChange={(event) => setSupplierDeliveryTime(event.target.value)} className={inputClass}>
                  <option value="">Seleccionar tiempo</option>
                  {(deliveryTimes.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                </select>
              </label>
            </div>
          </section>

          <fieldset className="mt-4 rounded-xl border border-slate-200 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Restricción de origen para las partidas seleccionadas</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(restrictions.data || []).map((option) => {
                const value = optionValue(option);
                const checked = originRestrictions.includes(value);
                return <label key={option.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}><input type="checkbox" checked={checked} onChange={() => toggleRestriction(value)} className="sr-only" />{option.label}</label>;
              })}
            </div>
          </fieldset>

          <section className="mt-4 overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-800">Partidas para este proveedor</p>
                <p className="text-xs text-slate-500">{selectedIds.size} de {items.length} seleccionadas</p>
              </div>
              <button type="button" onClick={toggleAll} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                {allSelected ? "Quitar selección" : "Seleccionar todas"}
              </button>
            </div>
            <div className="max-h-80 overflow-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="w-10 px-3 py-2 text-center text-[11px] font-semibold uppercase text-slate-500">Sel.</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Partida</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Descripción</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Cantidad</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Costo unitario *</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Moneda *</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase text-slate-500">Marca</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item) => {
                    const selected = selectedIds.has(item.id);
                    const form = itemForms[item.id];
                    return (
                      <tr key={item.id} className={selected ? "bg-amber-50/40" : "opacity-60"}>
                        <td className="px-3 py-3 text-center">
                          <input type="checkbox" checked={selected} onChange={() => toggleItem(item.id)} className="h-4 w-4 rounded border-slate-300 text-amber-500 focus:ring-amber-400" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs font-semibold text-slate-700">
                          {item.erpCode || "LOCAL"}
                          <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] text-slate-500">{item.erpCode ? "SIN STOCK" : "LOCAL"}</span>
                        </td>
                        <td className="max-w-xs px-3 py-3 text-xs text-slate-600">{item.erpDescription || item.customerDescription}</td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{item.qty} {item.unit}</td>
                        <td className="px-3 py-2">
                          <input type="number" min="0" step="0.01" value={form.unitCost} disabled={!selected} onChange={(event) => updateItemForm(item.id, { unitCost: event.target.value })} className={tableInputClass} placeholder="0.00" />
                        </td>
                        <td className="px-3 py-2">
                          <select value={form.currency} disabled={!selected} onChange={(event) => updateItemForm(item.id, { currency: event.target.value as QuoteCurrency })} className={tableInputClass}>
                            <option value="MXN">MXN</option>
                            <option value="USD">USD</option>
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <select value={form.brand} disabled={!selected} onChange={(event) => updateItemForm(item.id, { brand: event.target.value })} className={tableInputClass}>
                            <option value="">Seleccionar</option>
                            {(brands.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}
                          </select>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          {catalogsLoading && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando proveedores y catálogos...</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <p className="inline-flex items-center gap-2 text-xs text-slate-500"><PackageSearch className="h-4 w-4" />El precio vendedor se actualizará con el costo cotizado de cada partida.</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button>
            <button type="button" onClick={submit} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">Aplicar a {selectedIds.size} partida(s)</button>
          </div>
        </div>
      </div>
    </div>
  );
};
