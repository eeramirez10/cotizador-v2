import { DescriptionOutlined, RefreshOutlined } from "@mui/icons-material";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import type { WhatsAppInboundAttachment } from "../../modules/whatsapp/services/whatsapp-inbox.service";

export const ConfirmWhatsAppTaxDocumentExtractionModal = ({
  attachment,
  alreadyProcessed,
  processing,
  onClose,
  onConfirm,
}: {
  attachment: WhatsAppInboundAttachment | null;
  alreadyProcessed: boolean;
  processing: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) => (
  <Dialog open={Boolean(attachment)} onClose={processing ? undefined : onClose} fullWidth maxWidth="xs">
    <DialogTitle>
      <Stack direction="row" spacing={1} alignItems="center">
        <DescriptionOutlined color="primary" />
        <Typography component="span" variant="h6" fontWeight={700}>Extraer datos fiscales</Typography>
      </Stack>
    </DialogTitle>
    <DialogContent>
      <Typography variant="body2" color="text.secondary">
        La IA leerá <strong>{attachment?.originalName}</strong> y completará el borrador fiscal del cliente. Revisa los datos antes de enviarlos a Crédito y Cobranza.
      </Typography>
      {alreadyProcessed && <Alert severity="info" sx={{ mt: 2 }}>Esta constancia ya se procesó. Si continúas, se actualizará el borrador con una nueva extracción.</Alert>}
    </DialogContent>
    <DialogActions sx={{ px: 3, pb: 2.5 }}>
      <Button onClick={onClose} disabled={processing} color="inherit">Cancelar</Button>
      <Button onClick={onConfirm} disabled={processing} variant="contained" startIcon={alreadyProcessed ? <RefreshOutlined /> : <DescriptionOutlined />}>
        {processing ? "Procesando..." : alreadyProcessed ? "Procesar otra vez" : "Extraer datos"}
      </Button>
    </DialogActions>
  </Dialog>
);
