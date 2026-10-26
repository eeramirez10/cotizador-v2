import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton,
  FormControl, FormControlLabel, FormLabel, MenuItem, Radio, RadioGroup, Switch, Tab, Tabs,
  TextField, Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import {
  PurchaseRequisitionsService,
  type ErpProductCatalogs,
  type ErpClassificationSuggestion,
  type ErpProductDraftData,
  type RequisitionItem,
  type SatCatalogOption,
} from "../../modules/procurement/services/purchase-requisitions.service";
import { resolveBranchCode } from "../../modules/branches/branch.utils";
import { notifier } from "../../shared/notifications/notifier";

const profiles: Record<string, { primaryAccount: string; salesProfile: string }> = {
  "01": { primaryAccount: "1115001", salesProfile: "VG" },
  "02": { primaryAccount: "1115002", salesProfile: "V2" },
  "03": { primaryAccount: "1115003", salesProfile: "V3" },
  "04": { primaryAccount: "1115004", salesProfile: "V4" },
  "05": { primaryAccount: "1115005", salesProfile: "V5" },
  "06": { primaryAccount: "1115006", salesProfile: "V6" },
  "07": { primaryAccount: "1115008", salesProfile: "V7" },
};

const branchDefaults = (branchCode: string, branchName: string): Partial<ErpProductDraftData> | null => {
  const profile = profiles[resolveBranchCode(undefined, branchCode, branchName)];
  if (!profile) return null;
  return { ...profile, secondaryAccount: "4001001", costAccount: "5001001", purchaseProfile: "CG" };
};

const draftDefaults = (item: RequisitionItem): ErpProductDraftData => {
  const selected = item.offers.find((offer) => offer.isSelected);
  return {
    description: item.description.trim().slice(0, 60),
    extendedDescription: item.description.trim().slice(0, 4800),
    unitCode: item.unit,
    ean: item.erpEan || undefined,
    productType: 1,
    erpCurrency: selected?.currency === "USD" ? 2 : 1,
    ivaType: 0,
    noLayers: false,
  };
};

export const ErpProductDraftDialog = ({ requisitionId, item, branchCode, branchName, editable, open, onClose }: {
  requisitionId: string;
  item: RequisitionItem;
  branchCode: string;
  branchName: string;
  editable: boolean;
  open: boolean;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const key = ["purchase-requisitions", "erp-draft", requisitionId, item.id];
  const { data: draft, isPending, error } = useQuery({
    queryKey: key,
    queryFn: () => PurchaseRequisitionsService.getErpDraft(requisitionId, item.id),
    enabled: open,
  });
  const catalogs = useQuery({
    queryKey: ["erp-product-catalogs"],
    queryFn: () => PurchaseRequisitionsService.getErpProductCatalogs(),
    enabled: open,
    staleTime: 10 * 60_000,
  });
  const mutation = useMutation({
    mutationFn: (data: ErpProductDraftData) => PurchaseRequisitionsService.saveErpDraft(requisitionId, item.id, data),
    onSuccess: (saved) => {
      queryClient.setQueryData(key, saved);
      notifier.success("Ficha ERP guardada como borrador; aún no se ha dado de alta en Proscai.");
    },
    onError: (cause) => notifier.error(cause instanceof Error ? cause.message : "No se pudo guardar la ficha ERP."),
  });
  const fixedValues = branchDefaults(branchCode, branchName);

  return (
    <Dialog open={open} onClose={mutation.isPending ? undefined : onClose} keepMounted fullWidth maxWidth="md" scroll="paper"
      aria-labelledby="erp-product-draft-title"
      slotProps={{ paper: { sx: { height: { xs: "calc(100dvh - 32px)", sm: "min(760px, calc(100dvh - 64px))" }, maxHeight: "calc(100dvh - 32px)" } } }}>
      <DialogTitle id="erp-product-draft-title" sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
          <Typography variant="h6" fontWeight={600}>Ficha para alta de producto en ERP</Typography>
          <Chip label={draft ? "Borrador guardado" : "Sin preparar"} color={draft ? "info" : "default"} size="small" variant="outlined" />
        </Box>
        <IconButton aria-label="Cerrar ficha ERP" onClick={onClose} disabled={mutation.isPending} size="small"><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ px: { xs: 2, sm: 3 }, py: 3, minHeight: 0, overflowY: "auto" }}>
        {isPending ? <CircularProgress size={22} /> : error ? <Alert severity="error">No se pudo cargar la ficha ERP. Intenta de nuevo.</Alert> : (
          <ErpProductDraftFields
            key={`${item.id}:${draft?.updatedAt || "new"}`}
            initial={{ ...draftDefaults(item), ...draft?.data, ...(draft ? { extendedDescription: draft.data.extendedDescription || "" } : {}), ...fixedValues, productType: 1 }}
            catalogs={catalogs.data}
            catalogsLoading={catalogs.isPending}
            catalogsError={catalogs.isError}
            branchName={branchName}
            branchConfigured={Boolean(fixedValues)}
            editable={editable}
            saving={mutation.isPending}
            updatedAt={draft?.updatedAt}
            onSave={(data) => mutation.mutate(data)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const ErpProductDraftFields = ({ initial, catalogs, catalogsLoading, catalogsError, branchName, branchConfigured, editable, saving, updatedAt, onSave }: {
  initial: ErpProductDraftData;
  catalogs?: ErpProductCatalogs;
  catalogsLoading: boolean;
  catalogsError: boolean;
  branchName: string;
  branchConfigured: boolean;
  editable: boolean;
  saving: boolean;
  updatedAt?: string;
  onSave: (data: ErpProductDraftData) => void;
}) => {
  const [data, setData] = useState<ErpProductDraftData>(initial);
  const [tab, setTab] = useState(0);
  const [extendedOpen, setExtendedOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [satInput, setSatInput] = useState(initial.satCode || "");
  const [satQuery, setSatQuery] = useState("");
  const [satOpen, setSatOpen] = useState(false);
  const [satSelection, setSatSelection] = useState<SatCatalogOption | null>(null);
  const [suggestionDetails, setSuggestionDetails] = useState<ErpClassificationSuggestion[]>([]);
  const suggestion = useMutation({
    mutationFn: (description: string) => PurchaseRequisitionsService.suggestErpProductClassifications(description),
    onSuccess: (result) => {
      const additions = result.suggestions.filter((entry) => !data.classifications?.[entry.group]);
      setSuggestionDetails(additions);
      if (additions.length === 0) {
        notifier.info("La IA no encontró nuevas clasificaciones suficientemente claras. Puedes elegirlas manualmente.");
        return;
      }
      setData((current) => {
        const classifications = { ...current.classifications };
        for (const entry of additions) if (!classifications[entry.group]) classifications[entry.group] = entry.code;
        return { ...current, classifications };
      });
      setDirty(true);
      notifier.success(`${additions.length} clasificaciones sugeridas. Revísalas antes de guardar.`);
    },
    onError: (cause) => notifier.error(cause instanceof Error ? cause.message : "No se pudieron sugerir las clasificaciones."),
  });
  useEffect(() => {
    const timer = setTimeout(() => setSatQuery((satInput.trim() || data.description?.trim() || "").slice(0, 180)), 300);
    return () => clearTimeout(timer);
  }, [satInput, data.description]);
  const satOptions = useQuery({
    queryKey: ["sat-catalog", satQuery],
    queryFn: () => PurchaseRequisitionsService.searchSatCatalog(satQuery),
    enabled: tab === 0 && satOpen && satQuery.length >= 2,
    staleTime: 5 * 60_000,
  });
  const blocked = !editable || saving || suggestion.isPending;
  const setField = <K extends keyof ErpProductDraftData>(key: K, value: ErpProductDraftData[K]) => {
    setData((current) => ({ ...current, [key]: value }));
    setDirty(true);
  };
  const setClassification = (group: string, code: string) => {
    setData((current) => {
      const classifications = { ...current.classifications };
      if (code) classifications[group] = code;
      else delete classifications[group];
      return { ...current, classifications };
    });
    setDirty(true);
  };
  const textField = (key: "code" | "description" | "unitCode" | "ean" | "satCode", label: string, maxLength: number) => (
    <TextField label={label} size="small" required value={data[key] || ""} onChange={(event) => setField(key, event.target.value)}
      slotProps={{ htmlInput: { maxLength, ...(key === "satCode" ? { inputMode: "numeric" as const } : {}) } }}
      helperText={key === "satCode" ? "8 dígitos de la clave de producto/servicio SAT" : undefined} disabled={blocked} fullWidth />
  );
  const readOnly = (label: string, value: string) => <TextField label={label} size="small" value={value} slotProps={{ input: { readOnly: true } }} fullWidth />;
  const grid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))", gap: 2 };
  const missing = [
    !data.code?.trim() && "código", !data.description?.trim() && "descripción", !data.extendedDescription?.trim() && "descripción extendida",
    !data.unitCode?.trim() && "unidad",
    !data.ean?.trim() && "EAN", !data.satCode?.trim() && "clave CFDI", !data.weight && "peso",
  ].filter(Boolean).join(", ");
  const payload = (): ErpProductDraftData => ({
    ...data,
    code: data.code,
    description: data.description,
    unitCode: data.unitCode,
    ean: data.ean,
    satCode: data.satCode,
    productType: 1,
    erpCurrency: data.erpCurrency,
    weight: data.weight,
    noLayers: Boolean(data.noLayers),
    ivaType: data.ivaType,
    primaryAccount: data.primaryAccount,
    secondaryAccount: data.secondaryAccount,
    costAccount: data.costAccount,
    salesProfile: data.salesProfile,
    purchaseProfile: data.purchaseProfile,
  });

  return (
    <Box sx={{ display: "grid", gap: 2.5 }}>
      <Alert severity="info" variant="outlined">Esta ficha prepara el alta de {branchName}. No crea productos en Proscai ni captura costos o existencias.</Alert>
      {!branchConfigured && <Alert severity="warning">Esta sucursal no tiene cuentas y perfiles ERP configurados. No se podrá guardar la ficha.</Alert>}
      {catalogsError && <Alert severity="warning">No se pudieron cargar los catálogos de Proscai. La unidad puede capturarse manualmente; intenta abrir de nuevo la ficha para clasificar el producto.</Alert>}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "minmax(150px, 1fr) minmax(0, 3fr)" }, gap: 2 }}>
        {textField("code", "Código (ICOD)", 13)}
        {textField("description", "Descripción (IDESCR)", 60)}
      </Box>
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
        {catalogs ? <TextField label="Unidad (IUM)" select size="small" required value={data.unitCode || ""}
          onChange={(event) => setField("unitCode", event.target.value)} disabled={blocked} fullWidth>
          <MenuItem value="">Selecciona una unidad</MenuItem>
          {data.unitCode && !catalogs.units.some((unit) => unit.code === data.unitCode) && (
            <MenuItem value={data.unitCode}>{data.unitCode} · No figura en el catálogo actual</MenuItem>
          )}
          {catalogs.units.map((unit) => <MenuItem key={unit.id} value={unit.code} disabled={unit.inactive && unit.code !== data.unitCode}>
            {unit.code} · {unit.description}{unit.inactive ? " (inactiva)" : ""}
          </MenuItem>)}
        </TextField> : textField("unitCode", catalogsLoading ? "Unidad (IUM) · cargando catálogo" : "Unidad (IUM)", 30)}
        {readOnly("Tipo de producto (ITIPO)", "P.T. · Producto terminado")}
      </Box>
      <Box sx={{ display: "grid", gap: 0.75, justifyItems: "start" }}>
        <Button variant="outlined" size="small" startIcon={<DescriptionOutlinedIcon />} onClick={() => setExtendedOpen(true)}>
          {editable ? "Ver y editar descripción extendida (I2DESCR)" : "Ver descripción extendida (I2DESCR)"}
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {data.extendedDescription?.trim() || "Sin descripción extendida"}
        </Typography>
      </Box>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" scrollButtons="auto" aria-label="Secciones de alta ERP" sx={{ borderBottom: 1, borderColor: "divider", minHeight: 40 }}>
        <Tab label="General" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab label="Dimensiones" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab label="Importación" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab label="Impuestos" sx={{ minHeight: 40, textTransform: "none" }} />
        <Tab label="Clasificar" sx={{ minHeight: 40, textTransform: "none" }} />
      </Tabs>
      {tab === 0 && <Box sx={{ display: "grid", gap: 2 }} role="tabpanel" aria-label="General">
        <Box sx={grid}>
          {textField("ean", "EAN (IEAN)", 120)}
          <Box sx={{ display: "grid", gap: 0.5 }}>
            <Autocomplete<SatCatalogOption, false, false, true>
              freeSolo disabled={blocked} open={satOpen} onOpen={() => setSatOpen(true)} onClose={() => setSatOpen(false)}
              options={satOptions.data?.items ?? []} loading={satOptions.isFetching}
              value={satSelection ?? data.satCode ?? null} inputValue={satInput}
              filterOptions={(options) => options}
              getOptionLabel={(option) => typeof option === "string" ? option : `${option.code} · ${option.description}`}
              isOptionEqualToValue={(option, value) => typeof value !== "string" && option.code === value.code}
              onInputChange={(_, value, reason) => {
                setSatInput(value);
                if (reason === "input") {
                  setSatSelection(null);
                  setField("satCode", /^\d{1,8}$/.test(value.trim()) ? value.trim() : "");
                }
              }}
              onChange={(_, option) => {
                const code = typeof option === "string" ? option.trim() : option?.code || "";
                setSatSelection(typeof option === "string" ? null : option);
                setField("satCode", code);
                setSatInput(typeof option === "string" ? code : option ? `${option.code} · ${option.description}` : "");
              }}
              noOptionsText={satOptions.isError ? "Catálogo no disponible; captura la clave manualmente" : "Sin coincidencias"}
              renderInput={(params) => <TextField {...params} label="Clave CFDI (ICODSAT)" size="small" required
                helperText={data.satCode ? `Clave seleccionada: ${data.satCode}` : "Busca por descripción o captura una clave de 8 dígitos"}
                slotProps={{ htmlInput: { ...params.inputProps, maxLength: 180 } }} disabled={blocked} />}
            />
            <Button component="a" href="https://pys.sat.gob.mx/PyS/catPyS.aspx" target="_blank" rel="noopener noreferrer"
              size="small" startIcon={<OpenInNewIcon />} sx={{ justifySelf: "start", textTransform: "none" }}>
              Buscar clave en SAT
            </Button>
          </Box>
          <TextField label="Moneda ERP" select size="small" value={data.erpCurrency ?? 1} onChange={(event) => setField("erpCurrency", Number(event.target.value) as 1 | 2)} disabled={blocked} fullWidth>
            <MenuItem value={1}>1 · Pesos (MXN)</MenuItem><MenuItem value={2}>2 · Dólares (USD)</MenuItem>
          </TextField>
        </Box>
        <Box sx={grid}>
          {readOnly("Cuenta primaria (ICTA)", data.primaryAccount || "Sin configurar")}
          {readOnly("Cuenta secundaria (ICTADEV)", data.secondaryAccount || "Sin configurar")}
          {readOnly("Cuenta costo (ICTA3)", data.costAccount || "Sin configurar")}
        </Box>
      </Box>}
      {tab === 1 && <Box sx={grid} role="tabpanel" aria-label="Dimensiones">
        <TextField label="Peso (IPESO)" size="small" type="number" required value={data.weight ?? ""}
          onChange={(event) => setField("weight", event.target.value === "" ? undefined : Number(event.target.value))}
          slotProps={{ htmlInput: { min: 0, step: "any" } }} disabled={blocked} fullWidth />
      </Box>}
      {tab === 2 && <Box role="tabpanel" aria-label="Importación">
        <FormControlLabel control={<Switch checked={Boolean(data.noLayers)} onChange={(event) => setField("noLayers", event.target.checked)} disabled={blocked} />}
          label="No manejar capas (INOCAPAS)" />
        <Typography variant="caption" color="text.secondary" display="block">El campo INOCAPAS corresponde a este indicador en Proscai; no identifica por sí solo si el artículo es importado o exportado.</Typography>
      </Box>}
      {tab === 3 && <Box sx={{ display: "grid", gap: 2 }} role="tabpanel" aria-label="Impuestos">
        <Box sx={grid}>
          {readOnly("Perfil de ventas (ITMVTS)", data.salesProfile || "Sin configurar")}
          {readOnly("Perfil de compras (ITMREC)", data.purchaseProfile || "Sin configurar")}
        </Box>
        <FormControl>
          <FormLabel>IVA (IPORCIVA)</FormLabel>
          <RadioGroup row value={data.ivaType ?? 0} onChange={(event) => setField("ivaType", Number(event.target.value) as 0 | 1 | 2)}>
            <FormControlLabel value={0} control={<Radio size="small" disabled={blocked} />} label="General" />
            <FormControlLabel value={1} control={<Radio size="small" disabled={blocked} />} label="Exento" />
            <FormControlLabel value={2} control={<Radio size="small" disabled={blocked} />} label="Tasa 0%" />
          </RadioGroup>
        </FormControl>
      </Box>}
      {tab === 4 && <Box sx={{ display: "grid", gap: 2 }} role="tabpanel" aria-label="Clasificar">
        <Alert severity="info" variant="outlined">Las opciones provienen de FFAM. Se guardan las claves de cada grupo; el código agregado IFAM no se genera automáticamente.</Alert>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 1.5 }}>
          <Button variant="outlined" size="small" startIcon={suggestion.isPending ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            disabled={blocked || !catalogs || (data.extendedDescription || data.description || "").trim().length < 5}
            onClick={() => {
              const description = [data.description, data.extendedDescription].filter(Boolean).join("\n").slice(0, 5000);
              setSuggestionDetails([]);
              suggestion.mutate(description);
            }}>
            {suggestion.isPending ? "Analizando descripción..." : "Sugerir clasificaciones con IA"}
          </Button>
          <Typography variant="caption" color="text.secondary">Envía la descripción y las opciones FFAM a OpenAI. Solo llena grupos vacíos; revisa antes de guardar.</Typography>
        </Box>
        {suggestionDetails.length > 0 && <Alert severity="success" variant="outlined">
          {suggestionDetails.map((entry) => {
            const group = catalogs?.groups.find((item) => item.code === entry.group);
            const option = group?.options.find((item) => item.code === entry.code);
            return <Typography key={entry.group} variant="caption" display="block">
              {group?.label || entry.group}: {option?.description || entry.code} · Evidencia: “{entry.evidence}” · {Math.round(entry.confidence * 100)}%
            </Typography>;
          })}
        </Alert>}
        {catalogsLoading && <CircularProgress size={22} />}
        {catalogs && <Box sx={grid}>
          {catalogs.groups.map((group) => {
            const selected = data.classifications?.[group.code] || "";
            return <TextField key={group.code} select size="small" label={`${group.label} (IFAM${group.code})`}
              value={selected} onChange={(event) => setClassification(group.code, event.target.value)} disabled={blocked} fullWidth>
              <MenuItem value="">Sin clasificar</MenuItem>
              {selected && !group.options.some((option) => option.code === selected) && (
                <MenuItem value={selected}>{selected} · Clave guardada, no figura en el catálogo</MenuItem>
              )}
              {group.options.map((option) => <MenuItem key={option.code} value={option.code}>
                {option.code} · {option.description}
              </MenuItem>)}
            </TextField>;
          })}
        </Box>}
      </Box>}
      {missing && <Alert severity="warning" variant="outlined">Pendiente para alta: {missing}. Puedes guardar la ficha incompleta como borrador.</Alert>}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 1.5 }}>
        <Typography variant="caption" color="text.secondary">{updatedAt ? `Último guardado: ${new Date(updatedAt).toLocaleString("es-MX")}` : "Aún no se ha guardado esta ficha."}</Typography>
        {editable && <Button variant="contained" size="small" startIcon={<SaveOutlinedIcon />} disabled={saving || !branchConfigured || (!dirty && Boolean(updatedAt))}
          onClick={() => onSave(payload())} sx={{ bgcolor: "#b77913", "&:hover": { bgcolor: "#965f0f" } }}>
          {saving ? "Guardando..." : "Guardar borrador ERP"}
        </Button>}
      </Box>
      <Dialog open={extendedOpen} onClose={() => setExtendedOpen(false)} fullWidth maxWidth="md" aria-labelledby="erp-extended-description-title">
        <DialogTitle id="erp-extended-description-title">Descripción extendida (I2DESCR)</DialogTitle>
        <DialogContent dividers>
          <TextField label="Descripción completa del producto" value={data.extendedDescription || ""} multiline minRows={8} maxRows={16}
            onChange={(event) => setField("extendedDescription", event.target.value)}
            slotProps={{ htmlInput: { maxLength: 4800, readOnly: blocked } }}
            helperText={`${data.extendedDescription?.length || 0}/4800 caracteres · Se guarda junto con el borrador ERP.`}
            fullWidth />
        </DialogContent>
        <DialogActions><Button onClick={() => setExtendedOpen(false)}>{editable ? "Listo" : "Cerrar"}</Button></DialogActions>
      </Dialog>
    </Box>
  );
};
