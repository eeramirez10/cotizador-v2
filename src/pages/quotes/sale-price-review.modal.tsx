import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField } from "@mui/material";
import { useState } from "react";
import type { SavedQuoteRecord } from "../../modules/quotes/services/quotes.service";
import { getQuoteItemEffectiveCost } from "../../modules/quotes/utils/quote-fulfillment";

type QuoteItem = SavedQuoteRecord["items"][number];

interface Props {
  items: QuoteItem[];
  currency: "MXN" | "USD";
  exchangeRate: number;
  onClose: () => void;
  onSave: (items: Array<{ itemId: string; expectedUnitCost: number; unitPrice: number }>) => Promise<void>;
}

const effectiveCost = (item: QuoteItem, currency: "MXN" | "USD", exchangeRate: number) =>
  getQuoteItemEffectiveCost({
    qty: item.qty, stock: item.stock, erpCode: item.erpCode,
    costUsd: item.costUsd, costCurrency: item.erpCode ? "MXN" : item.costCurrency || "MXN",
    sellerQuotedUnitCost: item.sellerQuotedUnitCost ?? null,
    sellerQuotedCurrency: item.sellerQuotedCurrency || "MXN",
    sellerQuotedExchangeRate: item.sellerQuotedExchangeRate ?? null,
  }, currency, exchangeRate).effectiveUnitCost;

export const SalePriceReviewModal = ({ items, currency, exchangeRate, onClose, onSave }: Props) => {
  const [prices, setPrices] = useState<Record<string, string>>(() => Object.fromEntries(items.map((item) => [item.quoteItemId, String(item.unitPrice)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const money = (amount: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency }).format(amount);

  const submit = async () => {
    const values = items.map((item) => ({
      itemId: item.quoteItemId,
      expectedUnitCost: effectiveCost(item, currency, exchangeRate),
      unitPrice: Number(prices[item.quoteItemId]),
    }));
    if (values.some((item) => !Number.isFinite(item.unitPrice) || item.unitPrice <= 0)) {
      setError("Todas las partidas necesitan un precio de venta mayor a cero.");
      return;
    }
    setError("");
    setBusy(true);
    try { await onSave(values); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron guardar los precios."); }
    finally { setBusy(false); }
  };

  return <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="lg" aria-labelledby="sale-prices-title">
    <DialogTitle id="sale-prices-title" sx={{ fontSize: 18, fontWeight: 600 }}>Revisar precios de venta</DialogTitle>
    <DialogContent dividers>
      <p className="mb-4 text-sm text-slate-600">Compras actualizó los costos. Confirma el precio que verá el cliente; el costo del proveedor nunca se envía como precio de venta automáticamente.</p>
      <TableContainer sx={{ maxHeight: "55vh" }}><Table stickyHeader size="small" aria-label="Revisión de precios por partida">
        <TableHead><TableRow>{["Partida", "Cantidad", "Costo efectivo", "Recargo sobre costo %", `Precio venta (${currency})`].map((label) => <TableCell key={label} sx={{ bgcolor: "grey.100", fontWeight: 600 }}>{label}</TableCell>)}</TableRow></TableHead>
        <TableBody>{items.map((item) => {
          const cost = effectiveCost(item, currency, exchangeRate);
          const price = Number(prices[item.quoteItemId]);
          const markup = cost > 0 && Number.isFinite(price) ? ((price / cost) - 1) * 100 : 0;
          return <TableRow key={item.quoteItemId}>
            <TableCell sx={{ minWidth: 220 }}><span className="block text-xs font-semibold">{item.erpCode || item.ean || "Producto local"}</span><span className="block text-xs text-slate-500">{item.customerDescription || item.erpDescription}</span></TableCell>
            <TableCell>{item.qty} {item.unit}</TableCell>
            <TableCell>{money(cost)}</TableCell>
            <TableCell><TextField size="small" type="number" disabled={busy || cost <= 0} value={Number.isFinite(markup) ? Number(markup.toFixed(2)) : 0} onChange={(event) => setPrices((current) => ({ ...current, [item.quoteItemId]: String(Number((cost * (1 + Number(event.target.value) / 100)).toFixed(4))) }))} inputProps={{ step: "any" }} sx={{ width: 125 }} /></TableCell>
            <TableCell><TextField size="small" type="number" required disabled={busy} value={prices[item.quoteItemId]} onChange={(event) => setPrices((current) => ({ ...current, [item.quoteItemId]: event.target.value }))} inputProps={{ min: 0.0001, step: "any" }} sx={{ width: 155 }} /></TableCell>
          </TableRow>;
        })}</TableBody>
      </Table></TableContainer>
      {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
    </DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Cancelar</Button><Button variant="contained" onClick={() => void submit()} disabled={busy}>{busy ? "Guardando..." : "Confirmar precios"}</Button></DialogActions>
  </Dialog>;
};
