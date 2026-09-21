import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Divider, FormControl, FormHelperText, InputAdornment,
  InputLabel, List, ListItemButton, ListItemIcon, ListItemText, MenuItem, Paper, Select,
  Skeleton, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import {
  AutorenewRounded, ChatRounded, InfoOutlined, Inventory2Rounded, ReceiptLongRounded,
  RestartAltRounded, SaveRounded, SettingsSuggestRounded, ShieldOutlined,
} from "@mui/icons-material";
import type {
  ManagedSystemSetting, SystemSettingCategory, SystemSettingKey,
} from "../../modules/system/services/system-settings.service";
import {
  useResetSystemSettings, useSystemSettings, useUpdateSystemSettings,
} from "../../queries/system/use-system-settings";
import { notifier } from "../../shared/notifications/notifier";

type DraftValues = Partial<Record<SystemSettingKey, boolean | number>>;
type PendingAction = "SAVE" | "RESET" | null;

const categories: Array<{
  key: SystemSettingCategory;
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  { key: "QUOTES", label: "Cotizaciones", description: "Aprobaciones y métodos de captura", icon: <ReceiptLongRounded /> },
  { key: "PROCUREMENT", label: "Compras", description: "Flujo interno de requisiciones", icon: <Inventory2Rounded /> },
  { key: "WHATSAPP", label: "WhatsApp", description: "Bandeja, asistente y control humano", icon: <ChatRounded /> },
];

const sameValue = (left: boolean | number | undefined, right: boolean | number) => left === right;

const SettingsSkeleton = () => (
  <Stack spacing={1.5}>
    {[0, 1, 2].map((item) => (
      <Paper key={item} variant="outlined" sx={{ p: 2.5, borderRadius: 2.5 }}>
        <Skeleton width="36%" height={24} />
        <Skeleton width="72%" />
      </Paper>
    ))}
  </Stack>
);

export const SystemSettingsPage = () => {
  const settingsQuery = useSystemSettings();
  const updateMutation = useUpdateSystemSettings();
  const resetMutation = useResetSystemSettings();
  const [category, setCategory] = useState<SystemSettingCategory>("QUOTES");
  const [draft, setDraft] = useState<DraftValues>({});
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  useEffect(() => {
    if (!settingsQuery.data) return;
    setDraft(Object.fromEntries(
      settingsQuery.data.map((setting) => [setting.key, setting.value]),
    ) as DraftValues);
  }, [settingsQuery.data]);

  const categorySettings = useMemo(
    () => (settingsQuery.data || []).filter((setting) => setting.category === category),
    [category, settingsQuery.data],
  );
  const changedSettings = categorySettings.filter((setting) => !sameValue(draft[setting.key], setting.value));
  const overriddenSettings = categorySettings.filter((setting) => setting.overridden);
  const busy = updateMutation.isPending || resetMutation.isPending;
  const currentCategory = categories.find((item) => item.key === category)!;

  const setValue = (setting: ManagedSystemSetting, value: boolean | number) => {
    setDraft((current) => ({ ...current, [setting.key]: value }));
  };

  const save = async () => {
    try {
      await updateMutation.mutateAsync(changedSettings.map((setting) => ({
        key: setting.key,
        value: draft[setting.key] ?? setting.value,
      })));
      notifier.success("Configuración actualizada y aplicada.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo guardar la configuración.");
    } finally {
      setPendingAction(null);
    }
  };

  const reset = async () => {
    try {
      await resetMutation.mutateAsync(overriddenSettings.map((setting) => setting.key));
      notifier.success("Se restauraron los valores definidos por el servidor.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudieron restaurar los valores.");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <Box sx={{ mx: "auto", width: "100%", maxWidth: 1380, px: { xs: 1.5, md: 2.5 }, py: { xs: 2, md: 3 } }}>
      <Paper
        elevation={0}
        sx={{
          mb: 2.5,
          overflow: "hidden",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3.5,
          background: "linear-gradient(110deg, #fff8d8 0%, #ffffff 48%, #f8fafc 100%)",
        }}
      >
        <Box sx={{ height: 5, bgcolor: "#fcce01" }} />
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ p: { xs: 2.25, md: 3 } }}>
          <Box>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <SettingsSuggestRounded sx={{ color: "#182235" }} />
              <Typography component="h1" variant="h5" fontWeight={750} color="#182235">
                Configuración del sistema
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, maxWidth: 720 }}>
              Administra el comportamiento operativo sin exponer credenciales ni infraestructura sensible.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Chip icon={<ShieldOutlined />} label="Solo administradores" variant="outlined" />
            <Chip label="Auditoría activa" sx={{ bgcolor: "#fff1a8", color: "#4a3b00", fontWeight: 700 }} />
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "280px minmax(0, 1fr)" }, gap: 2.5 }}>
        <Paper variant="outlined" sx={{ borderRadius: 3, alignSelf: "start", overflow: "hidden" }}>
          <Box sx={{ px: 2.25, py: 2 }}>
            <Typography variant="overline" fontWeight={800} color="text.secondary">Áreas</Typography>
            <Typography variant="body2" color="text.secondary">Selecciona qué deseas administrar.</Typography>
          </Box>
          <Divider />
          <Box sx={{ display: { xs: "block", md: "none" }, p: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="settings-category-label">Área</InputLabel>
              <Select
                labelId="settings-category-label"
                label="Área"
                value={category}
                onChange={(event) => setCategory(event.target.value as SystemSettingCategory)}
              >
                {categories.map((item) => <MenuItem key={item.key} value={item.key}>{item.label}</MenuItem>)}
              </Select>
            </FormControl>
          </Box>
          <List disablePadding sx={{ display: { xs: "none", md: "block" }, p: 1 }}>
            {categories.map((item) => (
              <ListItemButton
                key={item.key}
                selected={category === item.key}
                onClick={() => setCategory(item.key)}
                sx={{
                  mb: 0.5,
                  borderRadius: 2,
                  alignItems: "flex-start",
                  "&.Mui-selected": { bgcolor: "#fff4bd", color: "#182235" },
                  "&.Mui-selected:hover": { bgcolor: "#ffef99" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40, mt: 0.25, color: "inherit" }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.label}
                  secondary={item.description}
                  primaryTypographyProps={{ fontWeight: 750, fontSize: 14 }}
                  secondaryTypographyProps={{ fontSize: 11.5, lineHeight: 1.35 }}
                />
              </ListItemButton>
            ))}
          </List>
          <Divider />
          <Box sx={{ p: 2, bgcolor: "#f8fafc" }}>
            <Typography variant="caption" color="text.secondary">
              Los secretos, URLs y credenciales continúan administrándose en el servidor.
            </Typography>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: "hidden", minWidth: 0 }}>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2} sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
            <Box>
              <Typography variant="h6" fontWeight={750}>{currentCategory.label}</Typography>
              <Typography variant="body2" color="text.secondary">{currentCategory.description}</Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<RestartAltRounded />}
                disabled={busy || overriddenSettings.length === 0}
                onClick={() => setPendingAction("RESET")}
              >
                Restaurar
              </Button>
              <Button
                variant="contained"
                startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveRounded />}
                disabled={busy || changedSettings.length === 0}
                onClick={() => setPendingAction("SAVE")}
                sx={{ bgcolor: "#182235", "&:hover": { bgcolor: "#273650" } }}
              >
                Guardar {changedSettings.length > 0 ? `(${changedSettings.length})` : ""}
              </Button>
            </Stack>
          </Stack>
          <Divider />

          <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: "#f8fafc", minHeight: 420 }}>
            {settingsQuery.isLoading && <SettingsSkeleton />}
            {settingsQuery.isError && (
              <Alert
                severity="error"
                action={<Button color="inherit" size="small" onClick={() => void settingsQuery.refetch()}>Reintentar</Button>}
              >
                {settingsQuery.error instanceof Error ? settingsQuery.error.message : "No se pudo cargar la configuración."}
              </Alert>
            )}
            {settingsQuery.isSuccess && categorySettings.length === 0 && (
              <Alert severity="info">Esta sección todavía no tiene configuraciones editables.</Alert>
            )}
            {settingsQuery.isSuccess && (
              <Stack spacing={1.5}>
                {categorySettings.map((setting) => {
                  const value = draft[setting.key] ?? setting.value;
                  const changed = !sameValue(value, setting.value);
                  return (
                    <Paper
                      key={setting.key}
                      variant="outlined"
                      sx={{
                        p: { xs: 2, md: 2.5 },
                        borderRadius: 2.5,
                        borderColor: changed ? "#e5b900" : "divider",
                        bgcolor: setting.available ? "background.paper" : "#f5f6f8",
                        transition: "border-color 160ms ease, background-color 160ms ease",
                      }}
                    >
                      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2.5} alignItems={{ sm: "center" }}>
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography variant="subtitle2" fontWeight={750} color="#26354d">{setting.label}</Typography>
                            {setting.overridden && <Chip size="small" label="Personalizado" variant="outlined" />}
                            {changed && <Chip size="small" label="Sin guardar" sx={{ bgcolor: "#fff1a8", fontWeight: 700 }} />}
                            {!setting.available && <Chip size="small" label="Infraestructura pendiente" color="warning" variant="outlined" />}
                            <Tooltip title={`Código interno: ${setting.key}`}>
                              <InfoOutlined sx={{ fontSize: 17, color: "text.disabled" }} />
                            </Tooltip>
                          </Stack>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 760 }}>
                            {setting.description}
                          </Typography>
                          {setting.availabilityMessage && <FormHelperText error sx={{ mx: 0 }}>{setting.availabilityMessage}</FormHelperText>}
                          {setting.warning && <FormHelperText sx={{ mx: 0, color: "#8a6700" }}>{setting.warning}</FormHelperText>}
                        </Box>

                        {setting.type === "BOOLEAN" ? (
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ alignSelf: { xs: "flex-end", sm: "center" } }}>
                            <Typography variant="caption" fontWeight={700} color={value ? "success.main" : "text.secondary"}>
                              {value ? "Activo" : "Inactivo"}
                            </Typography>
                            <Switch
                              checked={Boolean(value)}
                              disabled={!setting.available || busy}
                              onChange={(_, checked) => setValue(setting, checked)}
                              inputProps={{ "aria-label": setting.label }}
                              sx={{
                                "& .MuiSwitch-switchBase.Mui-checked": { color: "#182235" },
                                "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": { bgcolor: "#fcce01", opacity: 1 },
                              }}
                            />
                          </Stack>
                        ) : (
                          <TextField
                            type="number"
                            size="small"
                            value={value}
                            disabled={!setting.available || busy}
                            onChange={(event) => setValue(setting, Number(event.target.value))}
                            slotProps={{
                              htmlInput: { min: setting.min, max: setting.max, step: 1 },
                              input: setting.unit ? {
                                endAdornment: <InputAdornment position="end">{setting.unit}</InputAdornment>,
                              } : undefined,
                            }}
                            sx={{ width: { xs: "100%", sm: 190 } }}
                            helperText={`${setting.min ?? 0}–${setting.max ?? "∞"}`}
                          />
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Paper>
      </Box>

      <Dialog open={pendingAction !== null} onClose={() => !busy && setPendingAction(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{pendingAction === "RESET" ? "Restaurar configuración" : "Aplicar cambios"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {pendingAction === "RESET"
              ? `Se eliminarán los valores personalizados de ${currentCategory.label} y se usarán los definidos por el servidor.`
              : `Se aplicarán ${changedSettings.length} cambio(s) en ${currentCategory.label}. La acción quedará registrada en auditoría.`}
          </DialogContentText>
          {pendingAction === "SAVE" && category === "WHATSAPP" && (
            <Alert severity="warning" sx={{ mt: 2 }} icon={<AutorenewRounded />}>
              El worker puede tardar hasta 10 segundos en aplicar los cambios.
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" disabled={busy} onClick={() => setPendingAction(null)}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={busy}
            onClick={() => void (pendingAction === "RESET" ? reset() : save())}
            sx={{ bgcolor: pendingAction === "RESET" ? "#a15c00" : "#182235" }}
          >
            {busy ? "Procesando..." : pendingAction === "RESET" ? "Restaurar valores" : "Guardar cambios"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
