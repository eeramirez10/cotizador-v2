import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { AssignmentIndRounded, CheckCircleRounded, EditRounded, PictureAsPdfRounded, RefreshRounded, UploadFileRounded } from "@mui/icons-material";
import {
  CustomerOnboardingsService, type CustomerOnboarding, type CustomerOnboardingInput,
  type CustomerOnboardingStatus,
} from "../../modules/clients/services/customer-onboardings.service";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

const labels: Record<CustomerOnboardingStatus, string> = {
  COLLECTING: "Recopilando", PENDING_REVIEW: "Por revisar", PENDING_CXC: "Pendiente CxC",
  READY_FOR_ERP: "Listo para ERP", ERP_LINKED: "Vinculado ERP", REJECTED: "Rechazado",
  COMPLETED: "Validado", CANCELLED: "Cancelado",
};
const colors: Record<CustomerOnboardingStatus, "warning" | "info" | "success" | "default"> = {
  COLLECTING: "warning", PENDING_REVIEW: "info", PENDING_CXC: "warning", READY_FOR_ERP: "info",
  ERP_LINKED: "success", REJECTED: "default", COMPLETED: "success", CANCELLED: "default",
};
const fieldLabels: Record<string, string> = {
  legalName: "Razón social", taxId: "RFC", taxRegime: "Régimen fiscal", billingPostalCode: "Código postal fiscal",
  contactName: "Nombre del contacto", contactEmailOrWhatsapp: "Correo o WhatsApp",
};

const toInput = (item: CustomerOnboarding): CustomerOnboardingInput => ({
  legalName: item.legalName, taxId: item.taxId, taxRegime: item.taxRegime, cfdiUse: item.cfdiUse,
  billingStreet: item.billingStreet, billingExteriorNumber: item.billingExteriorNumber,
  billingInteriorNumber: item.billingInteriorNumber, billingNeighborhood: item.billingNeighborhood,
  billingCity: item.billingCity, billingState: item.billingState, billingPostalCode: item.billingPostalCode,
  billingCountry: item.billingCountry, contactName: item.contactName, contactEmail: item.contactEmail,
  contactPhone: item.contactPhone, contactWhatsapp: item.contactWhatsapp,
});

export const CustomerOnboardingsPanel = () => {
  const role = (useAuthStore((state) => state.user?.role) || "").toLowerCase();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<CustomerOnboarding[]>([]);
  const [status, setStatus] = useState<CustomerOnboardingStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerOnboarding | null>(null);
  const [draft, setDraft] = useState<CustomerOnboardingInput | null>(null);
  const [saving, setSaving] = useState(false);
  const [erpCode, setErpCode] = useState("");

  const load = async () => {
    setLoading(true);
    try { setItems(await CustomerOnboardingsService.list(status || undefined)); }
    catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudieron cargar los expedientes."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [status]);

  const metrics = useMemo(() => ({
    collecting: items.filter((item) => item.status === "COLLECTING").length,
    review: items.filter((item) => item.status === "PENDING_REVIEW").length,
    completed: items.filter((item) => item.status === "COMPLETED").length,
  }), [items]);

  const open = (item: CustomerOnboarding) => { setSelected(item); setDraft(toInput(item)); };
  const update = (key: keyof CustomerOnboardingInput, value: string) => setDraft((current) => current ? { ...current, [key]: value } : current);
  const save = async (submit: boolean) => {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const updated = await CustomerOnboardingsService.update(selected.id, draft);
      const result = submit ? await CustomerOnboardingsService.submitForCxc(updated.id) : updated;
      setItems((current) => current.map((item) => item.id === result.id ? result : item));
      setSelected(result); setDraft(toInput(result));
      notifier.success(submit ? "Expediente enviado a revisión de Crédito y Cobranza." : "Expediente guardado.");
      if (submit) { setSelected(null); setDraft(null); }
    } catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo guardar el expediente."); }
    finally { setSaving(false); }
  };

  const uploadTaxDocument = async (file?: File) => {
    if (!selected || !file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) return void notifier.warning("Selecciona la Constancia de Situación Fiscal en PDF.");
    setSaving(true);
    const toast = notifier.loading("Extrayendo datos de la constancia con IA...");
    try {
      const updated = await CustomerOnboardingsService.uploadTaxDocument(selected.id, file);
      setSelected(updated); setDraft(toInput(updated));
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      notifier.success("Constancia procesada. Revisa los datos extraídos.", { id: toast });
    } catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo procesar la constancia.", { id: toast }); }
    finally { setSaving(false); }
  };

  const openTaxDocument = async () => {
    if (!selected) return;
    try {
      const blob = await CustomerOnboardingsService.taxDocumentBlob(selected.id);
      const url = URL.createObjectURL(blob); window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo abrir la constancia."); }
  };

  const approve = async () => {
    if (!selected) return; setSaving(true);
    try { const result = await CustomerOnboardingsService.approveForErp(selected.id); setSelected(result); setItems((current) => current.map((item) => item.id === result.id ? result : item)); notifier.success("Datos fiscales validados. El cliente está listo para registrarse en Proscai."); }
    catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo validar el expediente."); }
    finally { setSaving(false); }
  };

  const linkErp = async () => {
    if (!selected) return; setSaving(true);
    try { const result = await CustomerOnboardingsService.markErpLinked(selected.id, erpCode); setSelected(result); setItems((current) => current.map((item) => item.id === result.id ? result : item)); notifier.success("Cliente vinculado con Proscai."); }
    catch (error) { notifier.error(error instanceof Error ? error.message : "No se pudo vincular con Proscai."); }
    finally { setSaving(false); }
  };

  return (
    <Box sx={{ pt: 2.5, minHeight: "100%" }}>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2} mb={2.5}>
        <Box><Typography variant="overline" color="warning.dark" fontWeight={700}>Clientes</Typography><Typography variant="h4" fontWeight={700}>Altas fiscales</Typography><Typography color="text.secondary" variant="body2">Expedientes creados después de aceptar una cotización.</Typography></Box>
        <Stack direction="row" alignItems="center" gap={1}>
          <FormControl size="small" sx={{ minWidth: 180 }}><InputLabel>Estado</InputLabel><Select value={status} label="Estado" onChange={(event) => setStatus(event.target.value as CustomerOnboardingStatus | "")}><MenuItem value="">Todos</MenuItem>{Object.entries(labels).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</Select></FormControl>
          <Button variant="outlined" startIcon={<RefreshRounded />} onClick={() => void load()}>Actualizar</Button>
        </Stack>
      </Stack>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} mb={2.5}>
        {[{ label: "Recopilando", value: metrics.collecting }, { label: "Por revisar", value: metrics.review }, { label: "Completados", value: metrics.completed }].map((metric) => <Paper key={metric.label} variant="outlined" sx={{ p: 2, minWidth: 180, borderRadius: 2.5 }}><Typography variant="caption" color="text.secondary">{metric.label}</Typography><Typography variant="h5" fontWeight={700}>{metric.value}</Typography></Paper>)}
      </Stack>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
        <Table><TableHead><TableRow sx={{ bgcolor: "#fff9df" }}><TableCell>Cliente</TableCell><TableCell>Cotización</TableCell><TableCell>Responsable</TableCell><TableCell>Estado</TableCell><TableCell>Pendientes</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead>
          <TableBody>{loading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 7 }}><CircularProgress size={28} /></TableCell></TableRow> : items.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 7, color: "text.secondary" }}>No hay expedientes con este filtro.</TableCell></TableRow> : items.map((item) => <TableRow key={item.id} hover><TableCell><Typography fontWeight={600}>{item.legalName || item.customer.displayName}</Typography><Typography variant="caption" color="text.secondary">{item.contactName || "Contacto pendiente"}</Typography></TableCell><TableCell>{item.acceptedQuote ? <Link to={`/quotes/${item.acceptedQuote.id}`}>{item.acceptedQuote.quoteNumber}</Link> : "-"}</TableCell><TableCell>{item.seller.name}<Typography display="block" variant="caption" color="text.secondary">{item.branch.name}</Typography></TableCell><TableCell><Chip size="small" color={colors[item.status]} label={labels[item.status]} /></TableCell><TableCell>{item.missingFields.length ? item.missingFields.map((field) => fieldLabels[field] || field).join(", ") : "Completo"}</TableCell><TableCell align="right"><Button size="small" startIcon={<EditRounded />} onClick={() => open(item)}>Revisar</Button></TableCell></TableRow>)}</TableBody>
        </Table>
      </TableContainer>
      <Dialog open={Boolean(selected && draft)} onClose={() => !saving && setSelected(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}><AssignmentIndRounded color="warning" /> Revisar alta de cliente</DialogTitle>
        {selected && draft && <DialogContent><Alert severity={selected.missingFields.length ? "warning" : "success"} sx={{ mb: 2 }}>{selected.missingFields.length ? `Faltan: ${selected.missingFields.map((field) => fieldLabels[field] || field).join(", ")}.` : "El expediente tiene los datos mínimos para enviarse a Crédito y Cobranza."}</Alert>
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2.5, bgcolor: "#fffdf4" }}><Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={1.5}><Box><Typography fontWeight={700}>Constancia de Situación Fiscal</Typography><Typography variant="caption" color="text.secondary">La IA llena el borrador; verifica los datos antes de enviarlos a CxC.</Typography>{selected.taxDocumentOriginalName && <Typography variant="body2" mt={0.5}>{selected.taxDocumentOriginalName}</Typography>}</Box><Stack direction="row" gap={1}><Button component="label" variant="contained" startIcon={<UploadFileRounded />} disabled={saving}>Subir PDF<input hidden type="file" accept="application/pdf,.pdf" onChange={(event) => { void uploadTaxDocument(event.target.files?.[0]); event.currentTarget.value = ""; }} /></Button>{selected.taxDocumentOriginalName && <Button variant="outlined" startIcon={<PictureAsPdfRounded />} onClick={() => void openTaxDocument()}>Ver</Button>}</Stack></Stack></Paper>
          <Typography fontWeight={700} mb={1}>Datos fiscales</Typography><Stack display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={1.5}>{([ ["legalName", "Razón social"], ["taxId", "RFC"], ["taxRegime", "Régimen fiscal"], ["cfdiUse", "Uso CFDI"], ["billingPostalCode", "Código postal fiscal"], ["billingCountry", "País"] ] as Array<[keyof CustomerOnboardingInput,string]>).map(([key,label]) => <TextField key={key} size="small" label={label} value={draft[key] || ""} onChange={(event) => update(key,event.target.value)} />)}</Stack>
          <Divider sx={{ my: 2.5 }} /><Typography fontWeight={700} mb={1}>Domicilio fiscal</Typography><Stack display="grid" gridTemplateColumns={{ xs: "1fr", sm: "2fr 1fr 1fr" }} gap={1.5}>{([ ["billingStreet", "Calle"], ["billingExteriorNumber", "Núm. exterior"], ["billingInteriorNumber", "Núm. interior"], ["billingNeighborhood", "Colonia"], ["billingCity", "Municipio / ciudad"], ["billingState", "Estado"] ] as Array<[keyof CustomerOnboardingInput,string]>).map(([key,label]) => <TextField key={key} size="small" label={label} value={draft[key] || ""} onChange={(event) => update(key,event.target.value)} />)}</Stack>
          <Divider sx={{ my: 2.5 }} /><Typography fontWeight={700} mb={1}>Contacto</Typography><Stack display="grid" gridTemplateColumns={{ xs: "1fr", sm: "1fr 1fr" }} gap={1.5}>{([ ["contactName", "Nombre"], ["contactEmail", "Correo"], ["contactPhone", "Teléfono"], ["contactWhatsapp", "WhatsApp"] ] as Array<[keyof CustomerOnboardingInput,string]>).map(([key,label]) => <TextField key={key} size="small" label={label} value={draft[key] || ""} onChange={(event) => update(key,event.target.value)} />)}</Stack>
        </DialogContent>}
        <DialogActions sx={{ px: 3, pb: 2.5, flexWrap: "wrap" }}><Button onClick={() => setSelected(null)} disabled={saving}>Cerrar</Button><Button variant="outlined" onClick={() => void save(false)} disabled={saving}>Guardar borrador</Button>{selected?.status !== "PENDING_CXC" && selected?.status !== "READY_FOR_ERP" && selected?.status !== "ERP_LINKED" && <Button variant="contained" color="warning" startIcon={saving ? <CircularProgress size={16} /> : <CheckCircleRounded />} onClick={() => void save(true)} disabled={saving || Boolean(selected?.missingFields.length)}>Enviar a CxC</Button>}{isAdmin && selected?.status === "PENDING_CXC" && <Button variant="contained" color="success" onClick={() => void approve()} disabled={saving}>Validar para ERP</Button>}{isAdmin && selected?.status === "READY_FOR_ERP" && <><TextField size="small" label="Código Proscai" value={erpCode} onChange={(event) => setErpCode(event.target.value)} /><Button variant="contained" color="success" onClick={() => void linkErp()} disabled={saving || !erpCode.trim()}>Marcar vinculado</Button></>}</DialogActions>
      </Dialog>
    </Box>
  );
};

export const CustomerOnboardingsPage = CustomerOnboardingsPanel;
