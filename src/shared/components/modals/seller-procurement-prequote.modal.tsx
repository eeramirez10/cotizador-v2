import { Loader2, PackageSearch, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuoteCatalogs } from "../../../queries/quote-catalogs/use-quote-catalogs";
import { useSuppliers } from "../../../queries/procurement/use-purchase-requisitions";
import type {
  ManualQuoteItem,
  ProcurementPrequoteData,
  QuoteCurrency,
} from "../../../store/quote/manual-quote.store";

interface SellerProcurementPrequoteModalProps {
  item: ManualQuoteItem;
  onClose: () => void;
  onSave: (data: ProcurementPrequoteData) => void;
}

const MANUAL_SUPPLIER = "__MANUAL__";
const optionValue = (option: { value: string | null; label: string }) => option.value || option.label;

export const SellerProcurementPrequoteModal = ({ item, onClose, onSave }: SellerProcurementPrequoteModalProps) => {
  const suppliers = useSuppliers(true);
  const brands = useQuoteCatalogs("PURCHASE_BRAND");
  const restrictions = useQuoteCatalogs("ORIGIN_RESTRICTION");
  const deliveryStates = useQuoteCatalogs("DELIVERY_STATE");
  const deliveryTimes = useQuoteCatalogs("DELIVERY_TIME");
  const [supplierSelection, setSupplierSelection] = useState(item.sellerSupplierId || MANUAL_SUPPLIER);
  const [supplierName, setSupplierName] = useState(item.sellerSupplierName || "");
  const [unitCost, setUnitCost] = useState(item.sellerQuotedUnitCost === null ? "" : String(item.sellerQuotedUnitCost));
  const [currency, setCurrency] = useState<QuoteCurrency>(item.sellerQuotedCurrency || "MXN");
  const [brand, setBrand] = useState(item.sellerQuotedBrand || "");
  const [originRestrictions, setOriginRestrictions] = useState<string[]>(item.sellerOriginRestrictions || []);
  const [deliveryState, setDeliveryState] = useState(item.sellerDeliveryState || "");
  const [supplierDeliveryTime, setSupplierDeliveryTime] = useState(item.sellerSupplierDeliveryTime || "");
  const [standard, setStandard] = useState(item.purchaseStandard || "");
  const [diameter, setDiameter] = useState(item.purchaseDiameter || "");
  const [thickness, setThickness] = useState(item.purchaseThickness || "");
  const [bore, setBore] = useState(item.purchaseBore || "");
  const [error, setError] = useState("");

  const supplierOptions = suppliers.data || [];
  const noRestrictionValue = useMemo(() => {
    const option = (restrictions.data || []).find((entry) => entry.code === "NO_RESTRICTION");
    return option ? optionValue(option) : "SIN RESTRICCIÓN";
  }, [restrictions.data]);

  const toggleRestriction = (value: string) => {
    setOriginRestrictions((current) => {
      if (current.includes(value)) return current.filter((entry) => entry !== value);
      if (value === noRestrictionValue) return [value];
      return [...current.filter((entry) => entry !== noRestrictionValue), value];
    });
  };

  const submit = () => {
    const normalizedSupplierName = supplierName.trim();
    const parsedCost = Number(unitCost);
    if (!normalizedSupplierName) return setError("Selecciona o escribe el proveedor que cotizó la partida.");
    if (!Number.isFinite(parsedCost) || parsedCost <= 0) return setError("El costo cotizado debe ser mayor a cero.");
    if (!deliveryState) return setError("Selecciona el estado donde se entregará el material.");
    if (!supplierDeliveryTime) return setError("Selecciona el tiempo de entrega ofrecido por el proveedor.");
    onSave({
      sellerSupplierId: supplierSelection === MANUAL_SUPPLIER ? null : supplierSelection,
      sellerSupplierName: normalizedSupplierName,
      sellerQuotedUnitCost: parsedCost,
      sellerQuotedCurrency: currency,
      sellerQuotedBrand: brand,
      sellerOriginRestrictions: originRestrictions,
      sellerDeliveryState: deliveryState,
      sellerSupplierDeliveryTime: supplierDeliveryTime,
      purchaseStandard: standard.trim(),
      purchaseDiameter: diameter.trim(),
      purchaseThickness: thickness.trim(),
      purchaseBore: bore.trim(),
    });
  };

  const inputClass = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";
  const labelClass = "text-xs font-semibold uppercase tracking-wide text-slate-500";

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="procurement-prequote-title">
      <div className="absolute inset-0 bg-slate-950/50" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><PackageSearch className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Información para Compras</p>
              <h2 id="procurement-prequote-title" className="text-base font-semibold text-slate-900">Datos cotizados por el vendedor</h2>
              <p className="mt-1 max-w-2xl text-xs text-slate-500">{item.erpDescription || item.customerDescription || "Partida sin descripción"}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="grid gap-4 md:grid-cols-2">
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
              <input value={supplierName} onChange={(event) => { setSupplierName(event.target.value); if (supplierSelection !== MANUAL_SUPPLIER) setSupplierSelection(MANUAL_SUPPLIER); }} className={inputClass} placeholder="Proveedor que cotizó el vendedor" />
            </label>
            <label className={labelClass}>Costo unitario cotizado *
              <input type="number" min="0" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} className={inputClass} placeholder="0.00" />
            </label>
            <label className={labelClass}>Moneda del costo *
              <select value={currency} onChange={(event) => setCurrency(event.target.value as QuoteCurrency)} className={inputClass}><option value="MXN">MXN</option><option value="USD">USD</option></select>
            </label>
            <label className={labelClass}>Marca
              <select value={brand} onChange={(event) => setBrand(event.target.value)} className={inputClass}><option value="">Seleccionar</option>{(brands.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}</select>
            </label>
            <label className={labelClass}>Estado de entrega *
              <select value={deliveryState} onChange={(event) => setDeliveryState(event.target.value)} className={inputClass}><option value="">Seleccionar estado</option>{(deliveryStates.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}</select>
            </label>
            <label className={labelClass}>Tiempo ofrecido por proveedor *
              <select value={supplierDeliveryTime} onChange={(event) => setSupplierDeliveryTime(event.target.value)} className={inputClass}><option value="">Seleccionar tiempo</option>{(deliveryTimes.data || []).map((option) => <option key={option.id} value={optionValue(option)}>{option.label}</option>)}</select>
            </label>
          </div>

          <fieldset className="mt-5 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Restricción de origen</legend>
            <div className="mt-1 flex flex-wrap gap-2">
              {(restrictions.data || []).map((option) => {
                const value = optionValue(option);
                const checked = originRestrictions.includes(value);
                return <label key={option.id} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold ${checked ? "border-amber-500 bg-amber-100 text-amber-800" : "border-slate-300 bg-white text-slate-600 hover:bg-slate-100"}`}><input type="checkbox" checked={checked} onChange={() => toggleRestriction(value)} className="sr-only" />{option.label}</label>;
              })}
            </div>
          </fieldset>

          <div className="mt-5">
            <p className={labelClass}>Datos técnicos para requisición</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className={labelClass}>Norma<input value={standard} onChange={(event) => setStandard(event.target.value)} className={inputClass} placeholder="ASTM A53" /></label>
              <label className={labelClass}>Diámetro<input value={diameter} onChange={(event) => setDiameter(event.target.value)} className={inputClass} placeholder='2"' /></label>
              <label className={labelClass}>Espesor<input value={thickness} onChange={(event) => setThickness(event.target.value)} className={inputClass} placeholder="Cédula 40" /></label>
              <label className={labelClass}>Bore<input value={bore} onChange={(event) => setBore(event.target.value)} className={inputClass} placeholder="Opcional" /></label>
            </div>
          </div>

          {error && <p className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
          {(suppliers.isLoading || brands.isLoading || restrictions.isLoading || deliveryStates.isLoading) && <p className="mt-4 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando catálogos...</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Cancelar</button>
          <button type="button" onClick={submit} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400">Guardar datos de compra</button>
        </div>
      </div>
    </div>
  );
};
