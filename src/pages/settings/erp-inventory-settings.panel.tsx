import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Box, Button, Checkbox, Chip, Divider, FormControl, FormControlLabel,
  FormLabel, Paper, Radio, RadioGroup, Skeleton, Stack, Typography,
} from "@mui/material";
import { SaveRounded } from "@mui/icons-material";
import { ErpInventoryService } from "../../modules/inventory/erp-inventory.service";
import { notifier } from "../../shared/notifications/notifier";

const settingsKey = ["erp-inventory-settings"];

export const ErpInventorySettingsPanel = () => {
  const client = useQueryClient();
  const settings = useQuery({
    queryKey: settingsKey, queryFn: ({ signal }) => ErpInventoryService.settings(signal), retry: false,
  });
  const [draft, setDraft] = useState<string[] | null>();
  const save = useMutation({
    mutationFn: ErpInventoryService.saveSettings,
    onSuccess: (data) => {
      client.setQueryData(settingsKey, data);
      setDraft(undefined);
      void client.resetQueries({ queryKey: ["erp-inventory"] });
      void client.resetQueries({ queryKey: ["erp-inventory-warehouses"] });
      notifier.success("Visibilidad de Inventario ERP actualizada.");
    },
    onError: error => notifier.error(error.message),
  });
  const warehouseCodes = draft === undefined ? settings.data?.warehouseCodes ?? null : draft;
  const warehouses = settings.data?.warehouses ?? [];
  const available = new Set(warehouses.map(({ code }) => code));
  const missing = warehouseCodes?.filter(code => !available.has(code)) ?? [];
  const selected = new Set(warehouseCodes);
  const changed = draft !== undefined && JSON.stringify(draft) !== JSON.stringify(settings.data?.warehouseCodes);
  const busy = save.isPending;
  const toggle = (code: string, checked: boolean) => {
    setDraft(current => {
      const next = new Set(current === undefined ? settings.data?.warehouseCodes : current);
      if (checked) next.add(code);
      else next.delete(code);
      return [...next].sort();
    });
  };

  return (
    <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", minWidth: 0 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
        <Box>
          <Typography variant="h6" fontWeight={750}>Inventario ERP</Typography>
          <Typography variant="body2" color="text.secondary">
            Elige qué almacenes pueden consultar los usuarios. No cambia sus permisos para cotizar.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {changed && <Button color="inherit" disabled={busy} onClick={() => setDraft(undefined)}>Descartar</Button>}
          <Button variant="contained" startIcon={<SaveRounded />}
            disabled={!changed || busy || settings.isError || missing.length > 0 || selected.size > 128}
            onClick={() => save.mutate(warehouseCodes)}
            sx={{ bgcolor: "#182235", "&:hover": { bgcolor: "#273650" } }}>
            {busy ? "Guardando..." : "Guardar"}
          </Button>
        </Stack>
      </Stack>
      <Divider />
      <Stack spacing={2} sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc" }}>
        {settings.isPending && <Skeleton variant="rounded" height={120} />}
        {settings.isError && (
          <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void settings.refetch()}>Reintentar</Button>}>
            {settings.error.message}
          </Alert>
        )}
        {settings.data && (
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5 }}>
            <Stack spacing={2}>
              <FormControl component="fieldset" disabled={busy || settings.isError}>
                <FormLabel component="legend">Almacenes visibles</FormLabel>
                <RadioGroup value={warehouseCodes === null ? "all" : "selected"} onChange={(_event, mode) => {
                  setDraft(mode === "all" ? null : [...available].sort());
                }}>
                  <FormControlLabel value="all" control={<Radio size="small" />} label="Todos los almacenes" />
                  <FormControlLabel value="selected" control={<Radio size="small" />} label="Solo seleccionados" />
                </RadioGroup>
              </FormControl>
              {warehouseCodes === null && <Typography variant="body2" color="text.secondary">
                Los almacenes nuevos en Proscai también aparecerán en el inventario.
              </Typography>}
              {warehouseCodes !== null && (
                <>
                  <Divider />
                  <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
                    <Chip size="small" label={`${selected.size} seleccionados`} />
                    <Button size="small" disabled={busy || settings.isError || available.size > 128}
                      onClick={() => setDraft([...available].sort())}>Seleccionar todos</Button>
                    <Button size="small" color="inherit" disabled={busy || settings.isError || selected.size === 0}
                      onClick={() => setDraft([])}>Quitar selección</Button>
                  </Stack>
                  {selected.size === 0 && <Alert severity="warning">Si guardas sin seleccionar almacenes, el inventario quedará vacío.</Alert>}
                  {selected.size > 128 && <Alert severity="warning">Selecciona hasta 128 almacenes o usa Todos los almacenes.</Alert>}
                  {missing.length > 0 && <Alert severity="warning">Desmarca los almacenes que ya no están en Proscai para guardar.</Alert>}
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", lg: "repeat(2, minmax(0, 1fr))" }, gap: 0.5, maxHeight: 360, overflowY: "auto" }}>
                    {warehouses.concat(missing.map(code => ({ code, name: "Ya no está en Proscai" }))).map(({ code, name }) => (
                      <FormControlLabel key={code} sx={{ m: 0, overflowWrap: "anywhere" }}
                        control={<Checkbox size="small" checked={selected.has(code)} disabled={busy || settings.isError}
                          onChange={(_event, checked) => toggle(code, checked)} />}
                        label={`${code} · ${name}`} />
                    ))}
                  </Box>
                </>
              )}
              {changed && <Typography variant="caption" color="text.secondary">Cambios sin guardar</Typography>}
            </Stack>
          </Paper>
        )}
      </Stack>
    </Paper>
  );
};
