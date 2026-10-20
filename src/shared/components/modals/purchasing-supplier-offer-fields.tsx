import { ExpandMore, StorefrontOutlined } from "@mui/icons-material";
import { Accordion, AccordionDetails, AccordionSummary, Button, FormControlLabel, MenuItem, Paper, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { useState } from "react";
import type { PurchaseRequisition, RequisitionItem, SaveSupplierInput, Supplier } from "../../../modules/procurement/services/purchase-requisitions.service";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import type { SupplierOfferFormValue } from "./supplier-offer.modal";
import type { TechnicalDataFormValue } from "../procurement/technical-data-editor";
import { SupplierRestrictionSelect, SupplierTechnicalCell, SupplierTechnicalRow } from "./supplier-offer-line-controls";
import { compactFieldSx } from "./supplier-offer-line-styles";

interface Props {
  requisition: PurchaseRequisition;
  item: RequisitionItem;
  value: SupplierOfferFormValue;
  onChange: (value: SupplierOfferFormValue) => void;
  suppliers: Supplier[];
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  onNewSupplier: (initialValues?: Partial<SaveSupplierInput>) => void;
  technical: TechnicalDataFormValue;
  onTechnicalChange: (value: TechnicalDataFormValue) => void;
  onSuggestTechnical: () => void;
  suggestingTechnical: boolean;
  restrictions: string[];
  restrictionOptions: QuoteCatalogOption[];
  onRestrictionsChange: (value: string[]) => void;
}

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;
const optionalNumber = (text: string) => text === "" ? null : Number(text);
const money = (amount: number, currency: string) => new Intl.NumberFormat("es-MX", {
  style: "currency", currency, maximumFractionDigits: 2,
}).format(amount);

const NumberField = ({ label, value, onChange, width = 110, required = false }: {
  label: string;
  value: number | string | null | undefined;
  onChange: (text: string) => void;
  width?: number;
  required?: boolean;
}) => <TextField size="small" type="number" label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value)} required={required} inputProps={{ min: 0, step: "any" }} sx={{ ...compactFieldSx, minWidth: Math.max(78, width - 18) }} />;

const CatalogField = ({ label, value, options, onChange, width = 135, required = false }: {
  label: string;
  value: string;
  options: QuoteCatalogOption[];
  onChange: (value: string) => void;
  width?: number;
  required?: boolean;
}) => {
  const hasCurrent = options.some((option) => optionValue(option) === value);
  return <TextField select size="small" required={required} label={label} value={value} onChange={(event) => onChange(event.target.value)} sx={{ ...compactFieldSx, minWidth: Math.max(100, width - 20) }}>
    <MenuItem value="">{required ? "Seleccionar" : "Sin indicar"}</MenuItem>
    {value && !hasCurrent && <MenuItem value={value}>{value}</MenuItem>}
    {options.map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}
  </TextField>;
};

export const PurchasingSupplierOfferFields = ({ requisition, item, value, onChange, suppliers, brands, origins, deliveryTimes, onNewSupplier, technical, onTechnicalChange, onSuggestTechnical, suggestingTechnical, restrictions, restrictionOptions, onRestrictionsChange }: Props) => {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  const update = <K extends keyof SupplierOfferFormValue>(key: K, next: SupplierOfferFormValue[K]) => onChange({ ...value, [key]: next });
  const updateLineAmount = (key: "qty" | "unitCost", next: string) => onChange({
    ...value, [key]: next, documentSubtotal: null, documentTax: null, documentTotal: null,
  });
  const updateDocumentAmount = <K extends keyof SupplierOfferFormValue>(key: K, next: SupplierOfferFormValue[K]) => onChange({
    ...value, [key]: next, documentTax: null, documentTotal: null,
  });
  const subtotal = Number(value.qty) * Number(value.unitCost);
  const supplierIsListed = suppliers.some((supplier) => supplier.id === value.supplierId);

  return <div className="space-y-3">
    <section className="grid gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2 text-[11px] text-slate-700 sm:grid-cols-2 lg:grid-cols-4" aria-label="Datos de la requisición">
      <div><p className="font-medium text-slate-500">Requisición</p><p className="mt-0.5 font-semibold text-slate-900">{requisition.requisitionNumber}</p></div>
      <div><p className="font-medium text-slate-500">Sucursal</p><p className="mt-0.5 font-semibold text-slate-900">{requisition.branchName}</p></div>
      <div><p className="font-medium text-slate-500">Cotización cliente</p><p className="mt-0.5 font-semibold text-slate-900">{requisition.quoteNumber}</p></div>
      <div><p className="font-medium text-slate-500">Destino</p><p className="mt-0.5 font-semibold text-slate-900">{item.deliveryPlace || requisition.deliveryPlace || requisition.deliveryState || "Pendiente"}</p></div>
    </section>

    <section aria-label="Encabezado de la cotización del proveedor">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-slate-900">Datos del proveedor y su cotización</h3>
        <Button type="button" size="small" variant="outlined" startIcon={<StorefrontOutlined fontSize="small" />} onClick={() => onNewSupplier()}>Nuevo proveedor</Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 [&_.MuiTextField-root]:min-w-0">
        <TextField select size="small" required label="Proveedor" value={value.supplierId} onChange={(event) => {
          const supplierId = event.target.value;
          const supplier = suppliers.find((entry) => entry.id === supplierId);
          onChange({ ...value, supplierId, supplierName: supplier?.name || "" });
        }} sx={{ ...compactFieldSx, gridColumn: { sm: "span 2" } }}>
          <MenuItem value="">Seleccionar proveedor</MenuItem>
          {value.supplierId && !supplierIsListed && <MenuItem value={value.supplierId}>{value.supplierName || value.supplierId}</MenuItem>}
          {suppliers.map((supplier) => <MenuItem key={supplier.id} value={supplier.id}>{supplier.erpCode ? `${supplier.erpCode} · ` : ""}{supplier.name}</MenuItem>)}
        </TextField>
        <TextField size="small" sx={compactFieldSx} label="No. cotización proveedor" value={value.externalReference} onChange={(event) => update("externalReference", event.target.value)} inputProps={{ maxLength: 120 }} />
        <TextField size="small" sx={compactFieldSx} type="date" label="Fecha cotización" value={value.quoteDate || ""} onChange={(event) => update("quoteDate", event.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField size="small" sx={compactFieldSx} type="date" label="Vigencia" value={value.validUntil} onChange={(event) => update("validUntil", event.target.value)} InputLabelProps={{ shrink: true }} />
        <TextField select size="small" sx={compactFieldSx} required label="Moneda" value={value.currency} onChange={(event) => update("currency", event.target.value as SupplierOfferFormValue["currency"])}><MenuItem value="MXN">MXN</MenuItem><MenuItem value="USD">USD</MenuItem></TextField>
        {value.currency === "USD" && <NumberField label="Tipo de cambio cotización" value={value.exchangeRate} onChange={(next) => update("exchangeRate", next)} required />}
        <TextField size="small" sx={compactFieldSx} label="Condiciones de pago" value={value.paymentTerms || ""} onChange={(event) => update("paymentTerms", event.target.value)} />
        <TextField size="small" sx={compactFieldSx} label="Condiciones de entrega" value={value.deliveryTerms || ""} onChange={(event) => update("deliveryTerms", event.target.value)} />
      </div>
    </section>

    <section aria-label="Partida cotizada por el proveedor">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2"><h3 className="text-xs font-semibold text-slate-900">Partida cotizada</h3><p className="text-[10px] text-slate-500">El código del proveedor no cambia el EAN ni da de alta el producto en Proscai.</p></div>
      <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%" }}>
        <Table size="small" sx={{ minWidth: 1880, "& td": { fontSize: 10, px: 0.75, py: 0.65 } }} aria-label="Captura tabular de una cotización de proveedor">
          <TableHead sx={{ backgroundColor: "grey.900" }}><TableRow sx={{ "& th": { color: "white", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap", px: 0.75, py: 0.7 } }}>
            {["Part.", "Cant. solicitada", "Cant. proveedor", "UM", "Código ERP / EAN", "Código proveedor", "Solicitado por cliente", "Producto ERP", "Descripción proveedor", "Datos técnicos", "Restricción", "Precio lista", "Desc. %", "Costo neto", "Marca", "Origen", "Entrega", "Subtotal"].map((label) => <TableCell key={label}>{label}</TableCell>)}
          </TableRow></TableHead>
          <TableBody><TableRow sx={{ verticalAlign: "top" }}>
            <TableCell>{item.position}</TableCell>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{item.qty} {item.unit}</TableCell>
            <TableCell><NumberField label="Cantidad" value={value.qty} onChange={(next) => updateLineAmount("qty", next)} width={92} required /></TableCell>
            <TableCell><TextField size="small" label="UM" value={value.unit ?? item.unit} onChange={(event) => update("unit", event.target.value)} sx={{ ...compactFieldSx, minWidth: 75 }} inputProps={{ maxLength: 30 }} /></TableCell>
            <TableCell sx={{ minWidth: 115, fontWeight: 600 }}>{item.erpEan || item.erpCode || <span className="text-amber-800">Alta ERP pendiente</span>}</TableCell>
            <TableCell><TextField size="small" label="Código proveedor" value={value.supplierProductCode || ""} onChange={(event) => update("supplierProductCode", event.target.value.toUpperCase())} sx={{ ...compactFieldSx, minWidth: 110 }} inputProps={{ maxLength: 120 }} /></TableCell>
            <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.customerDescription || "No capturada"}</TableCell>
            <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.erpDescription || "-"}</TableCell>
            <TableCell sx={{ minWidth: 205 }}><TextField size="small" sx={compactFieldSx} fullWidth multiline minRows={2} label="Descripción proveedor" placeholder="Pendiente de cotización" value={value.supplierDescription} onChange={(event) => update("supplierDescription", event.target.value.toUpperCase())} inputProps={{ maxLength: 500 }} /></TableCell>
            <SupplierTechnicalCell value={technical} onExpand={() => setTechnicalOpen((current) => !current)} onSuggest={onSuggestTechnical} suggesting={suggestingTechnical} />
            <TableCell><SupplierRestrictionSelect required value={restrictions} options={restrictionOptions} onChange={onRestrictionsChange} /></TableCell>
            <TableCell><NumberField label="Lista" value={value.listUnitPrice} onChange={(next) => update("listUnitPrice", optionalNumber(next))} /></TableCell>
            <TableCell><NumberField label="Descuento" value={value.discountPct} onChange={(next) => update("discountPct", optionalNumber(next))} width={95} /></TableCell>
            <TableCell><NumberField label="Costo neto" value={value.unitCost} onChange={(next) => updateLineAmount("unitCost", next)} width={110} required /></TableCell>
            <TableCell><CatalogField label="Marca" value={value.brand} options={brands} onChange={(next) => update("brand", next)} /></TableCell>
            <TableCell><CatalogField required label="Origen" value={value.origin} options={origins} onChange={(next) => update("origin", next)} /></TableCell>
            <TableCell><CatalogField required label="Plazo" value={value.deliveryTime} options={deliveryTimes} onChange={(next) => update("deliveryTime", next)} width={160} /></TableCell>
            <TableCell sx={{ minWidth: 110, fontWeight: 600 }}>{Number.isFinite(subtotal) && value.unitCost !== "" ? money(subtotal, value.currency) : "Pendiente"}</TableCell>
          </TableRow><SupplierTechnicalRow colSpan={18} value={technical} onChange={onTechnicalChange} open={technicalOpen} /></TableBody>
        </Table>
      </TableContainer>
      <p className="mt-1 text-[10px] text-slate-500">Esta captura registra una sola partida. Para cotizar otra, usa su botón de Compras.</p>
    </section>

    <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" aria-label="Condiciones de la partida">
      <TextField size="small" sx={compactFieldSx} type="date" label="Fecha disponible" value={value.availableDate || ""} onChange={(event) => update("availableDate", event.target.value)} InputLabelProps={{ shrink: true }} />
      <NumberField label="Cantidad mínima" value={value.minimumQty} onChange={(next) => update("minimumQty", optionalNumber(next))} />
      <TextField size="small" multiline minRows={2} label="Notas del proveedor" value={value.notes} onChange={(event) => update("notes", event.target.value)} inputProps={{ maxLength: 1000 }} sx={{ ...compactFieldSx, gridColumn: { sm: "span 2" } }} />
    </section>

    <Accordion disableGutters variant="outlined" sx={{ borderRadius: "8px !important", "&:before": { display: "none" } }}>
      <AccordionSummary expandIcon={<ExpandMore />}><span className="text-sm font-semibold text-slate-800">Desglose del documento del proveedor (opcional)</span></AccordionSummary>
      <AccordionDetails>
        <p className="mb-3 text-xs text-slate-500">Revisa estos importes si aplicaste una extracción con IA. Si cambias cantidad o costo neto, se limpian los totales extraídos para evitar importes desactualizados.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Subtotal documento" value={value.documentSubtotal} onChange={(next) => updateDocumentAmount("documentSubtotal", optionalNumber(next))} />
          <NumberField label="Descuento documento" value={value.documentDiscount} onChange={(next) => updateDocumentAmount("documentDiscount", optionalNumber(next) ?? 0)} />
          <NumberField label="Flete" value={value.documentFreight} onChange={(next) => updateDocumentAmount("documentFreight", optionalNumber(next) ?? 0)} />
          <NumberField label="Otros cargos" value={value.documentOtherCharges} onChange={(next) => updateDocumentAmount("documentOtherCharges", optionalNumber(next) ?? 0)} />
          <NumberField label="IVA %" value={value.documentTaxRate === null || value.documentTaxRate === undefined ? 16 : value.documentTaxRate > 1 ? value.documentTaxRate : value.documentTaxRate * 100} onChange={(next) => updateDocumentAmount("documentTaxRate", next === "" ? null : Number(next) / 100)} />
          <NumberField label="IVA documento" value={value.documentTax} onChange={(next) => onChange({ ...value, documentTax: optionalNumber(next), documentTotal: null })} />
          <NumberField label="Total documento" value={value.documentTotal} onChange={(next) => update("documentTotal", optionalNumber(next))} />
          <FormControlLabel control={<Switch checked={value.taxIncluded === true} onChange={(_, checked) => updateDocumentAmount("taxIncluded", checked)} />} label="IVA incluido" />
        </div>
      </AccordionDetails>
    </Accordion>
  </div>;
};
