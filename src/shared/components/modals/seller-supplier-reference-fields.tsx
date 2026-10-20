import { StorefrontOutlined } from "@mui/icons-material";
import { Button, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { useState } from "react";
import type { SaveSupplierInput, Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import type { ManualQuoteItem } from "../../../store/quote/manual-quote.store";
import type { TechnicalDataFormValue } from "../procurement/technical-data-editor";
import type { SupplierOfferFormValue } from "./supplier-offer.modal";
import { SupplierRestrictionSelect, SupplierTechnicalCell, SupplierTechnicalRow } from "./supplier-offer-line-controls";
import { compactFieldSx } from "./supplier-offer-line-styles";

interface Props {
  item: ManualQuoteItem;
  deliveryState: string;
  deliveryStates: QuoteCatalogOption[];
  onDeliveryStateChange: (value: string) => void;
  technical: TechnicalDataFormValue;
  onTechnicalChange: (value: TechnicalDataFormValue) => void;
  onSuggestTechnical: () => void;
  suggestingTechnical: boolean;
  restrictions: string[];
  restrictionOptions: QuoteCatalogOption[];
  onRestrictionsChange: (value: string[]) => void;
  value: SupplierOfferFormValue;
  onChange: (value: SupplierOfferFormValue) => void;
  suppliers: Supplier[];
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  onNewSupplier: (initialValues?: Partial<SaveSupplierInput>) => void;
}

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(amount);

const CatalogField = ({ label, value, options, onChange, required = false }: {
  label: string;
  value: string;
  options: QuoteCatalogOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) => <TextField select size="small" required={required} label={label} value={value} onChange={(event) => onChange(event.target.value)} sx={{ ...compactFieldSx, minWidth: 112 }}>
  <MenuItem value="">{required ? "Seleccionar" : "Sin indicar"}</MenuItem>
  {value && !options.some((option) => optionValue(option) === value) && <MenuItem value={value}>{value}</MenuItem>}
  {options.map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}
</TextField>;

export const SellerSupplierReferenceFields = ({ item, deliveryState, deliveryStates, onDeliveryStateChange, technical, onTechnicalChange, onSuggestTechnical, suggestingTechnical, restrictions, restrictionOptions, onRestrictionsChange, value, onChange, suppliers, brands, origins, deliveryTimes, onNewSupplier }: Props) => {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const update = <K extends keyof SupplierOfferFormValue>(key: K, next: SupplierOfferFormValue[K]) => onChange({ ...value, [key]: next });
  const subtotal = Number(value.qty) * Number(value.unitCost);
  const supplierIsListed = suppliers.some((supplier) => supplier.id === value.supplierId);

  return <div className="space-y-3 [&_.MuiTextField-root]:min-w-0">
    <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-slate-700" aria-label="Tipo de solicitud">
      <span className="font-semibold text-slate-900">Cotización del proveedor · una partida</span>
      <span className="ml-3">Solicitado: {item.qty} {item.unit} · Por comprar: {value.qty} {item.unit}</span>
    </section>

    <section aria-label="Encabezado de la referencia del proveedor">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-semibold text-slate-900">Proveedor y documento</h3><Button type="button" size="small" variant="outlined" startIcon={<StorefrontOutlined fontSize="small" />} onClick={() => onNewSupplier()}>Nuevo proveedor</Button></div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 [&_.MuiTextField-root]:text-[11px]" style={{ fontSize: 11 }}>
        <TextField select size="small" required label="Proveedor" value={value.supplierId} onChange={(event) => {
          const supplierId = event.target.value;
          const supplier = suppliers.find((entry) => entry.id === supplierId);
          onChange({ ...value, supplierId, supplierName: supplier?.name || "" });
        }} sx={{ ...compactFieldSx, gridColumn: { sm: "span 2" } }}>
          <MenuItem value="">Seleccionar proveedor</MenuItem>
          {value.supplierId && !supplierIsListed && <MenuItem value={value.supplierId}>{value.supplierName || value.supplierId}</MenuItem>}
          {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</MenuItem>)}
        </TextField>
        <TextField size="small" sx={compactFieldSx} label="No. cotización proveedor" value={value.externalReference} onChange={(event) => update("externalReference", event.target.value)} inputProps={{ maxLength: 160 }} />
        <TextField size="small" sx={compactFieldSx} type="date" label="Vigencia" value={value.validUntil} onChange={(event) => update("validUntil", event.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select size="small" sx={compactFieldSx} required label="Moneda" value={value.currency} onChange={(event) => update("currency", event.target.value as SupplierOfferFormValue["currency"])}><MenuItem value="MXN">MXN</MenuItem><MenuItem value="USD">USD</MenuItem></TextField>
        <TextField select size="small" sx={compactFieldSx} required label="Estado de entrega" value={deliveryState} onChange={(event) => onDeliveryStateChange(event.target.value)}>
          <MenuItem value="">Seleccionar estado</MenuItem>
          {deliveryStates.map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}
        </TextField>
        {value.currency === "USD" && <TextField size="small" sx={compactFieldSx} type="number" required label="Tipo de cambio cotización" value={value.exchangeRate} onChange={(event) => update("exchangeRate", event.target.value)} inputProps={{ min: 0, step: "any" }} />}
      </div>
    </section>

    <section aria-label="Tabla de referencia del proveedor">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-semibold text-slate-900">Material cotizado</h3><p className="text-[10px] text-slate-500">Código interno y código del proveedor son datos distintos.</p></div>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth: 1580, "& td": { fontSize: 10, px: 0.75, py: 0.65 } }} aria-label="Referencia tabular de una partida cotizada por el proveedor">
          <TableHead sx={{ backgroundColor: "grey.900" }}><TableRow sx={{ "& th": { color: "white", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap", px: 0.75, py: 0.7 } }}>
            {["Part.", "Cant.", "UM", "Código ERP / EAN", "Código proveedor", "Solicitado por cliente", "Producto ERP", "Descripción proveedor", "Datos técnicos", "Restricción", "Costo neto", "Moneda", "Marca", "Origen", "Entrega", "Subtotal"].map((label) => <TableCell key={label}>{label}</TableCell>)}
          </TableRow></TableHead>
          <TableBody><TableRow sx={{ verticalAlign: "top" }}>
            <TableCell>1</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{value.qty || "-"}</TableCell>
            <TableCell>{item.unit}</TableCell>
            <TableCell sx={{ minWidth: 120, fontWeight: 600 }}>{item.ean || item.erpCode || <span className="text-amber-800">Alta ERP pendiente</span>}</TableCell>
            <TableCell><TextField size="small" label="Código proveedor" value={value.supplierProductCode || ""} onChange={(event) => update("supplierProductCode", event.target.value.toUpperCase())} sx={{ ...compactFieldSx, minWidth: 110 }} inputProps={{ maxLength: 120 }} /></TableCell>
            <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.customerDescription || "No capturada"}</TableCell>
            <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.erpDescription || "-"}</TableCell>
            <TableCell sx={{ minWidth: 205 }}><TextField size="small" sx={compactFieldSx} fullWidth multiline minRows={2} label="Descripción proveedor" placeholder="Pendiente de cotización" value={value.supplierDescription} onChange={(event) => update("supplierDescription", event.target.value.toUpperCase())} inputProps={{ maxLength: 500 }} /></TableCell>
            <SupplierTechnicalCell value={technical} onExpand={() => setTechnicalOpen((current) => !current)} onSuggest={onSuggestTechnical} suggesting={suggestingTechnical} />
            <TableCell><SupplierRestrictionSelect required value={restrictions} options={restrictionOptions} onChange={onRestrictionsChange} /></TableCell>
            <TableCell><TextField size="small" type="number" required label="Costo unitario" value={value.unitCost} onChange={(event) => update("unitCost", event.target.value)} sx={{ ...compactFieldSx, minWidth: 105 }} inputProps={{ min: 0, step: "any" }} /></TableCell>
            <TableCell>{value.currency}</TableCell>
            <TableCell><CatalogField label="Marca" value={value.brand} options={brands} onChange={(next) => update("brand", next)} /></TableCell>
            <TableCell><CatalogField required label="Origen" value={value.origin} options={origins} onChange={(next) => update("origin", next)} /></TableCell>
            <TableCell><CatalogField required label="Plazo" value={value.deliveryTime} options={deliveryTimes} onChange={(next) => update("deliveryTime", next)} /></TableCell>
            <TableCell sx={{ minWidth: 110, fontWeight: 600 }}>{value.unitCost !== "" && Number.isFinite(subtotal) ? money(subtotal, value.currency) : "Pendiente"}</TableCell>
          </TableRow><SupplierTechnicalRow colSpan={16} value={technical} onChange={onTechnicalChange} open={technicalOpen} /></TableBody>
        </Table>
      </TableContainer>
    </section>

    <TextField size="small" sx={compactFieldSx} fullWidth multiline minRows={2} label="Notas y condiciones del proveedor" value={value.notes} onChange={(event) => update("notes", event.target.value)} inputProps={{ maxLength: 1000 }} />
  </div>;
};
