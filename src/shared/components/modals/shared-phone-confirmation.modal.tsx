import { WarningAmberRounded } from "@mui/icons-material";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { useCallback, useEffect, useRef, useState } from "react";
import { registerSharedPhoneConfirmation } from "../../../modules/clients/services/shared-phone-confirmation";

interface PendingConfirmation {
  phones: string[];
  resolve: (confirmed: boolean) => void;
}

export const SharedPhoneConfirmationModal = () => {
  const queue = useRef<PendingConfirmation[]>([]);
  const [active, setActive] = useState<PendingConfirmation | null>(null);

  const request = useCallback((phones: string[]) => new Promise<boolean>((resolve) => {
    queue.current.push({ phones, resolve });
    if (queue.current.length === 1) setActive(queue.current[0]);
  }), []);

  useEffect(() => {
    const unregister = registerSharedPhoneConfirmation(request);
    const pendingQueue = queue.current;
    return () => {
      unregister();
      for (const pending of pendingQueue.splice(0)) pending.resolve(false);
    };
  }, [request]);

  const finish = (confirmed: boolean) => {
    const current = queue.current.shift();
    current?.resolve(confirmed);
    setActive(queue.current[0] ?? null);
  };

  return (
    <Dialog open={Boolean(active)} onClose={() => finish(false)} fullWidth maxWidth="xs" aria-labelledby="shared-phone-title">
      <DialogTitle id="shared-phone-title">
        <Stack direction="row" alignItems="center" spacing={1}>
          <WarningAmberRounded color="warning" />
          <Typography component="span" variant="h6" fontWeight={700}>Número compartido</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 2 }}>
          {active?.phones.length === 1 ? "Este número ya está asociado" : "Estos números ya están asociados"} a otro cliente:
          <strong> {active?.phones.join(", ")}</strong>
        </Alert>
        <Typography variant="body2" color="text.secondary">
          Puedes corregir el número o guardar el contacto compartido. Si ese número escribe por WhatsApp, el asistente pedirá el folio antes de consultar una cotización.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={() => finish(false)}>Corregir número</Button>
        <Button color="warning" variant="contained" onClick={() => finish(true)}>Guardar de todos modos</Button>
      </DialogActions>
    </Dialog>
  );
};
