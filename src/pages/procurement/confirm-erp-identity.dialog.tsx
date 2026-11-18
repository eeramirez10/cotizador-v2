import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from "@mui/material";
import { PurchaseRequisitionsService, type ErpProductIdentity } from "../../modules/procurement/services/purchase-requisitions.service";
import { notifier } from "../../shared/notifications/notifier";

export function ConfirmErpIdentityDialog({ requisitionId, itemId, branchName, unit, confirming, onConfirm, onClose }: {
  requisitionId: string;
  itemId: string;
  branchName: string;
  unit: string;
  confirming: boolean;
  onConfirm: (identity: ErpProductIdentity) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState<string | null>(null);
  const draft = useQuery({
    queryKey: ["purchase-requisitions", "erp-draft", requisitionId, itemId],
    queryFn: () => PurchaseRequisitionsService.getErpDraft(requisitionId, itemId),
  });
  const value = code ?? draft.data?.data.code ?? "";
  const lookup = useMutation({
    mutationFn: (input: string) => PurchaseRequisitionsService.verifyErpIdentity(requisitionId, itemId, input),
    onError: (error) => notifier.error(error.message),
  });
  const verified = lookup.data?.code === value.trim().toUpperCase() ? lookup.data : undefined;
  const busy = lookup.isPending || confirming;

  return (
    <Dialog open onClose={busy ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle>Confirmar código de Proscai</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography variant="body2">
            {branchName} · Unidad cotizada: <strong>{unit}</strong>. Si el producto no existe para esta sucursal, dalo de alta manualmente en Proscai con la ficha y vuelve a verificar.
          </Typography>
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!busy && value.trim()) lookup.mutate(value.trim().toUpperCase());
          }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField label="Código ERP (ICOD)" size="small" fullWidth value={value}
                slotProps={{ htmlInput: { maxLength: 13 } }} disabled={busy}
                onChange={(event) => { setCode(event.target.value.toUpperCase()); lookup.reset(); }} />
              <Button type="submit" variant="outlined" disabled={!value.trim() || busy}>
                {lookup.isPending ? "Verificando…" : "Verificar"}
              </Button>
            </Stack>
          </form>
          {lookup.error && <Alert severity="error">{lookup.error.message}</Alert>}
          {verified && <Alert severity="success">
            <strong>{verified.code}</strong> · {verified.description || "Sin descripción"}<br />
            EAN: {verified.ean || "Sin EAN"} · Unidad ERP: {verified.unit}
          </Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" disabled={!verified || busy}
          onClick={() => { if (verified) void onConfirm(verified); }}>
          {confirming ? "Confirmando…" : "Confirmar vínculo"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
