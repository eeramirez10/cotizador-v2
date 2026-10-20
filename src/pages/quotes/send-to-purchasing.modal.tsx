import { useState } from "react";
import { Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { useQuotePurchasingBuyers } from "../../queries/procurement/use-purchase-requisitions";

export interface PurchasingCandidate {
  id: string;
  position: number;
  description: string;
  qty: number;
  unit: string;
}

export const SendToPurchasingModal = ({ quoteId, items, busy, onClose, onSubmit }: {
  quoteId: string;
  items: PurchasingCandidate[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (itemIds: string[], buyerUserId: string) => Promise<boolean>;
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => items.map((item) => item.id));
  const [buyerId, setBuyerId] = useState("");
  const buyersQuery = useQuotePurchasingBuyers(quoteId);
  const buyers = buyersQuery.data || [];
  const selectedBuyerId = buyerId || (buyers.length === 1 ? buyers[0].id : "");

  const toggle = (itemId: string) => setSelectedIds((current) =>
    current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Solicitar precios a Compras</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Selecciona las partidas que Compras deberá cotizar. No necesitas capturar proveedor, costo ni plazo. Esto no genera todavía un pedido al proveedor.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setSelectedIds(items.map((item) => item.id))} disabled={busy}>Seleccionar todas</Button>
            <Button size="small" onClick={() => setSelectedIds([])} disabled={busy}>Limpiar</Button>
          </Stack>
          <Stack spacing={0.5} sx={{ maxHeight: 280, overflowY: "auto" }}>
            {items.map((item) => (
              <FormControlLabel key={item.id} sx={{ mx: 0, alignItems: "flex-start", border: "1px solid", borderColor: "divider", borderRadius: 1, py: 0.5, pr: 1 }}
                control={<Checkbox size="small" checked={selectedIds.includes(item.id)} onChange={() => toggle(item.id)} disabled={busy} />}
                label={<Stack component="span" sx={{ pt: 0.3 }}><Typography variant="body2" fontWeight={600}>#{item.position} · {item.description}</Typography><Typography variant="caption" color="text.secondary">{item.qty} {item.unit}</Typography></Stack>}
              />
            ))}
          </Stack>
          {buyersQuery.isLoading && <Stack direction="row" spacing={1} alignItems="center"><CircularProgress size={16} /><Typography variant="body2">Buscando compradores de la sucursal...</Typography></Stack>}
          {buyersQuery.isError && <Alert severity="error">No se pudieron cargar los compradores. Cierra y vuelve a intentarlo.</Alert>}
          {!buyersQuery.isLoading && !buyersQuery.isError && buyers.length === 0 && <Alert severity="warning">No hay un responsable de Compras activo en esta sucursal.</Alert>}
          {buyers.length === 1 && <Typography variant="body2">Se asignará a <strong>{buyers[0].fullName}</strong> (Compras de la sucursal).</Typography>}
          {buyers.length > 1 && (
            <TextField select fullWidth size="small" label="Responsable de Compras" value={buyerId} onChange={(event) => setBuyerId(event.target.value)} disabled={busy} SelectProps={{ native: true }}>
              <option value="">Seleccionar comprador</option>
              {buyers.map((buyer) => <option key={buyer.id} value={buyer.id}>{buyer.fullName}</option>)}
            </TextField>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" disabled={busy || buyersQuery.isLoading || buyersQuery.isError || !selectedBuyerId || selectedIds.length === 0}
          onClick={() => void onSubmit(selectedIds, selectedBuyerId).then((saved) => { if (saved) onClose(); })}>
          {busy ? "Enviando..." : `Solicitar precio de ${selectedIds.length} partida(s)`}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
