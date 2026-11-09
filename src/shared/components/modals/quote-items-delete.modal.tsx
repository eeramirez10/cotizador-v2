import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Typography } from "@mui/material";

interface QuoteItemToDelete {
  id: string;
  customerDescription: string;
  erpDescription: string;
  erpCode: string;
  qty: number;
  unit: string;
}

export const QuoteItemsDeleteModal = ({ open, items, totalItems, disabled, onClose, onConfirm }: {
  open: boolean;
  items: QuoteItemToDelete[];
  totalItems: number;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open={open} onClose={disabled ? undefined : onClose} fullWidth maxWidth="sm"
    aria-labelledby="quote-items-delete-title" aria-describedby="quote-items-delete-description">
    <DialogTitle id="quote-items-delete-title">
      Eliminar {items.length === 1 ? "partida seleccionada" : `${items.length} partidas seleccionadas`}
    </DialogTitle>
    <DialogContent>
      <DialogContentText id="quote-items-delete-description" sx={{ mb: 2 }}>
        Se quitarán únicamente de esta cotización; los productos del catálogo no se eliminarán.
        Guarda después la cotización para aplicar los cambios en el sistema.
      </DialogContentText>
      {items.length === totalItems && items.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          La cotización quedará sin partidas. Tendrás que agregar al menos una antes de guardarla.
        </Alert>
      )}
      <Box component="ul" sx={{ m: 0, p: 0, listStyle: "none", maxHeight: 240, overflowY: "auto" }}>
        {items.slice(0, 20).map((item) => (
          <Box component="li" key={item.id} sx={{ py: 1, borderBottom: "1px solid", borderColor: "divider" }}>
            <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{item.customerDescription || item.erpDescription || "Sin descripción"}</Typography>
            <Typography variant="caption" color="text.secondary">{item.erpCode || "Sin código ERP"} · {item.qty} {item.unit}</Typography>
          </Box>
        ))}
      </Box>
      {items.length > 20 && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Y {items.length - 20} partidas seleccionadas más.</Typography>}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2 }}>
      <Button onClick={onClose} disabled={disabled} color="inherit" autoFocus>Cancelar</Button>
      <Button onClick={onConfirm} disabled={disabled || items.length === 0} color="error" variant="contained">
        Eliminar {items.length === 1 ? "partida" : `${items.length} partidas`}
      </Button>
    </DialogActions>
  </Dialog>
);
