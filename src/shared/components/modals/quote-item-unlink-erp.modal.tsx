import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@mui/material";

export const QuoteItemUnlinkErpModal = ({ item, disabled, onClose, onConfirm }: {
  item: { erpCode: string; ean: string; erpDescription: string; customerDescription: string; qty: number; unit: string };
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open fullWidth maxWidth="sm" onClose={disabled ? undefined : onClose}
    aria-labelledby="quote-unlink-erp-title" aria-describedby="quote-unlink-erp-description">
    <DialogTitle id="quote-unlink-erp-title">Desvincular producto ERP</DialogTitle>
    <DialogContent>
      <DialogContentText id="quote-unlink-erp-description" sx={{ mb: 2 }}>
        La partida quedará sin vincular. No se eliminará de la cotización ni se modificará el producto en Proscai.
      </DialogContentText>
      <Box sx={{ p: 1.5, mb: 2, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
        <Typography variant="body2" fontWeight={700}>{item.erpCode} · {item.ean || "Sin EAN"}</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, overflowWrap: "anywhere" }}>{item.erpDescription}</Typography>
        <Typography variant="caption" color="text.secondary">Cantidad conservada: {item.qty} {item.unit}</Typography>
      </Box>
      <Alert severity="warning">
        Se limpiarán el código, EAN, stock y costo del ERP. Se conservarán la descripción solicitada,
        cantidad, comentarios y referencias de proveedor. Si no hay descripción solicitada, se usará la actual como referencia.
      </Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        El precio capturado manualmente se conserva; el calculado desde costos se recalcula.
        Revisa precio y plazo, vincula el producto correcto o agrega uno local y guarda la cotización.
      </Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} disabled={disabled} color="inherit" autoFocus>Cancelar</Button>
      <Button onClick={onConfirm} disabled={disabled} variant="contained" color="warning">Desvincular ERP</Button>
    </DialogActions>
  </Dialog>
);
