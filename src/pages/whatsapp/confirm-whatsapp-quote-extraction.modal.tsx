import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import { FileSearch, RefreshCw, Sparkles } from "lucide-react";
import type { WhatsAppInboundAttachment } from "../../modules/whatsapp/services/whatsapp-inbox.service";

export const ConfirmWhatsAppQuoteExtractionModal = ({
  attachment,
  processing,
  onClose,
  onConfirm,
}: {
  attachment: WhatsAppInboundAttachment | null;
  processing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => {
  const isReprocessing = Boolean(attachment && attachment.quoteExtractionCount > 0);

  return (
    <Dialog
      open={Boolean(attachment)}
      onClose={processing ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      PaperProps={{ sx: { borderRadius: 2.5 } }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          {isReprocessing ? <RefreshCw size={20} /> : <FileSearch size={20} />}
          <Typography component="span" variant="h6" fontWeight={850}>
            {isReprocessing ? "Procesar archivo nuevamente" : "Generar cotización desde archivo"}
          </Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            La IA extraerá las partidas de <strong>{attachment?.originalName}</strong> y preparará un nuevo borrador para que el vendedor lo revise.
          </Typography>
          {isReprocessing && (
            <Alert severity="warning" variant="outlined">
              Este archivo ya fue procesado {attachment?.quoteExtractionCount} {attachment?.quoteExtractionCount === 1 ? "vez" : "veces"}. Al continuar se realizará una extracción nueva.
            </Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={processing} color="inherit">Cancelar</Button>
        <Button
          onClick={onConfirm}
          disabled={processing}
          variant="contained"
          startIcon={isReprocessing ? <RefreshCw size={16} /> : <Sparkles size={16} />}
          sx={{ bgcolor: "#172033", "&:hover": { bgcolor: "#0f172a" } }}
        >
          {processing ? "Procesando..." : isReprocessing ? "Procesar otra vez" : "Extraer partidas"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
