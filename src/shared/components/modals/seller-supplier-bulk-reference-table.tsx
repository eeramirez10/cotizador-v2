import { MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { Fragment, useState } from "react";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import { getQuoteItemFulfillment } from "../../../modules/quotes/utils/quote-fulfillment";
import type { ManualQuoteItem, QuoteCurrency } from "../../../store/quote/manual-quote.store";
import type { BulkProcurementItemForm } from "./bulk-procurement-item.types";
import { SupplierRestrictionSelect, SupplierTechnicalCell, SupplierTechnicalRow } from "./supplier-offer-line-controls";
import { compactFieldSx } from "./supplier-offer-line-styles";

interface Props {
  items: ManualQuoteItem[];
  forms: Record<string, BulkProcurementItemForm>;
  brands: QuoteCatalogOption[];
  origins: QuoteCatalogOption[];
  deliveryTimes: QuoteCatalogOption[];
  restrictions: QuoteCatalogOption[];
  suggestingItemId: string | null;
  busy: boolean;
  onSuggest: (itemId: string) => void;
  onChange: (itemId: string, value: Partial<BulkProcurementItemForm>) => void;
}

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;
const money = (amount: number, currency: QuoteCurrency) => new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(amount);

const CatalogField = ({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: QuoteCatalogOption[];
  onChange: (value: string) => void;
}) => <TextField select size="small" label={label} value={value} onChange={(event) => onChange(event.target.value)} sx={{ ...compactFieldSx, minWidth: 105 }}>
  <MenuItem value="">Sin indicar</MenuItem>
  {value && !options.some((option) => optionValue(option) === value) && <MenuItem value={value}>{value}</MenuItem>}
  {options.map((option) => <MenuItem key={option.id} value={optionValue(option)}>{option.label}</MenuItem>)}
</TextField>;

export const SellerSupplierBulkReferenceTable = ({ items, forms, brands, origins, deliveryTimes, restrictions, suggestingItemId, busy, onSuggest, onChange }: Props) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const toggleTechnical = (id: string) => setExpandedIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  return <TableContainer component={Paper} variant="outlined" sx={{ maxWidth: "100%", maxHeight: { xs: "42vh", md: "52vh" }, overflow: "auto" }}>
    <Table stickyHeader size="small" sx={{ minWidth: 1800, "& td": { fontSize: 10, px: 0.75 } }} aria-label="Partidas de la referencia para un proveedor">
      <TableHead><TableRow sx={{ "& th": { bgcolor: "grey.900", color: "white", fontWeight: 600, fontSize: 10, whiteSpace: "nowrap", px: 0.75, py: 0.7 } }}>
        {["Part.", "Cant.", "UM", "Código ERP / EAN", "Código proveedor", "Solicitado por cliente", "Producto ERP", "Descripción proveedor", "Datos técnicos", "Restricción", "Costo neto", "Moneda", "Marca", "Origen", "Entrega", "Subtotal"].map((label) => <TableCell key={label}>{label}</TableCell>)}
      </TableRow></TableHead>
      <TableBody>{items.map((item, index) => {
        const form = forms[item.id];
        const qty = getQuoteItemFulfillment(item).purchaseQty;
        const subtotal = qty * Number(form.unitCost);
        return <Fragment key={item.id}><TableRow sx={{ verticalAlign: "top", borderTop: "1px solid", borderColor: "divider", "& > td": { pt: 2, pb: 1 } }}>
          <TableCell>{index + 1}</TableCell>
          <TableCell sx={{ whiteSpace: "nowrap" }}>{qty}</TableCell>
          <TableCell>{item.unit}</TableCell>
          <TableCell sx={{ minWidth: 115, fontWeight: 600 }}>{item.ean || item.erpCode || <span className="text-amber-800">Alta ERP pendiente</span>}</TableCell>
          <TableCell><TextField size="small" label="Código proveedor" value={form.supplierProductCode} onChange={(event) => onChange(item.id, { supplierProductCode: event.target.value.toUpperCase() })} sx={{ ...compactFieldSx, minWidth: 110 }} inputProps={{ maxLength: 120 }} /></TableCell>
          <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.customerDescription || "No capturada"}</TableCell>
          <TableCell sx={{ minWidth: 180, maxWidth: 240, overflowWrap: "anywhere" }}>{item.erpDescription || "-"}</TableCell>
          <TableCell sx={{ minWidth: 205 }}><TextField size="small" multiline minRows={2} fullWidth label="Descripción proveedor" placeholder="Pendiente de cotización" value={form.supplierDescription} onChange={(event) => onChange(item.id, { supplierDescription: event.target.value.toUpperCase() })} sx={compactFieldSx} inputProps={{ maxLength: 500 }} /></TableCell>
          <SupplierTechnicalCell value={form} onExpand={() => toggleTechnical(item.id)} onSuggest={() => onSuggest(item.id)} suggesting={suggestingItemId === item.id} disabled={busy} reviewRequired={form.technicalRequiresReview} />
          <TableCell><SupplierRestrictionSelect id={`supplier-restrictions-${item.id}`} value={form.originRestrictions} options={restrictions} onChange={(originRestrictions) => onChange(item.id, { originRestrictions })} /></TableCell>
          <TableCell><TextField size="small" type="number" required label="Costo unitario" value={form.unitCost} onChange={(event) => onChange(item.id, { unitCost: event.target.value })} sx={{ ...compactFieldSx, minWidth: 105 }} inputProps={{ min: 0, step: "any" }} /></TableCell>
          <TableCell><TextField select size="small" label="Moneda" value={form.currency} onChange={(event) => onChange(item.id, { currency: event.target.value as QuoteCurrency })} sx={{ ...compactFieldSx, minWidth: 85 }}><MenuItem value="MXN">MXN</MenuItem><MenuItem value="USD">USD</MenuItem></TextField>{form.currency === "USD" && <TextField size="small" type="number" label="Tipo de cambio" value={form.exchangeRate} onChange={(event) => onChange(item.id, { exchangeRate: event.target.value })} sx={{ ...compactFieldSx, mt: 1, minWidth: 85 }} inputProps={{ min: 0, step: "any" }} />}</TableCell>
          <TableCell><CatalogField label="Marca" value={form.brand} options={brands} onChange={(brand) => onChange(item.id, { brand })} /></TableCell>
          <TableCell><CatalogField label="Origen" value={form.origin} options={origins} onChange={(origin) => onChange(item.id, { origin })} /></TableCell>
          <TableCell><CatalogField label="Plazo" value={form.deliveryTime} options={deliveryTimes} onChange={(deliveryTime) => onChange(item.id, { deliveryTime })} /></TableCell>
          <TableCell sx={{ minWidth: 105, fontWeight: 600 }}>{form.unitCost !== "" && Number.isFinite(subtotal) ? money(subtotal, form.currency) : "Pendiente"}</TableCell>
        </TableRow><SupplierTechnicalRow colSpan={16} value={form} onChange={(technical) => onChange(item.id, technical)} open={expandedIds.has(item.id)} reviewRequired={form.technicalRequiresReview} onConfirm={() => onChange(item.id, { technicalRequiresReview: false })} /></Fragment>;
      })}</TableBody>
    </Table>
  </TableContainer>;
};
