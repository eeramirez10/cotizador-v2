import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router";
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, LinearProgress, MenuItem, Paper, Stack, Switch, Tab, Table, TableBody, TableCell,
  TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, Typography } from "@mui/material";
import { CalendarClock, Download, Eye, FileChartColumn, RefreshCw, Search } from "lucide-react";
import { CommercialReportsService, CHANNEL_LABELS, reportParams, STATUS_LABELS,
  type CommercialReport, type ReportFilters, type ReportGroup, type ReportQuoteRow } from "../../modules/reports/services/commercial-reports.service";
import { initialReportFilters, PERIODS, reportPeriod, TIMEZONES, validateReportFilters } from "../../modules/reports/report-filters";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

const money = (value: number, currency: "MXN" | "USD") => new Intl.NumberFormat("es-MX", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
const count = (value: number) => value.toLocaleString("es-MX");
const columnStyle = { whiteSpace: "nowrap", fontSize: 12 } as const;
const tableHead = { "& th": { bgcolor: "grey.100", fontWeight: 700, whiteSpace: "nowrap", fontSize: 12 } } as const;

export function CommercialReportsPage() {
  const user = useAuthStore(state => state.user);
  const role = user?.role.toLowerCase();
  const isAdmin = role === "admin";
  const isSeller = role === "seller";
  const [filters, setFilters] = useState(initialReportFilters);
  const [applied, setApplied] = useState(initialReportFilters);
  const [preset, setPreset] = useState("MONTH_TO_DATE");
  const [tab, setTab] = useState("summary");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [exportOptions, setExportOptions] = useState({ includeBreakdowns: true, includeDetails: false });
  const [exporting, setExporting] = useState(false);
  const [preview, setPreview] = useState<{ url: string; filename: string } | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const dirty = JSON.stringify(reportParams(filters)) !== JSON.stringify(reportParams(applied));
  const access = [user?.id, role, user?.branchId];
  const options = useQuery({
    queryKey: ["commercial-reports", "options", ...access],
    queryFn: ({ signal }) => CommercialReportsService.options(signal), staleTime: 60_000,
    retry: false, enabled: Boolean(user), refetchOnWindowFocus: false,
  });
  const report = useQuery({
    queryKey: ["commercial-reports", "quotes", ...access, reportParams(applied, page + 1, pageSize)],
    queryFn: ({ signal }) => CommercialReportsService.get(applied, page + 1, pageSize, signal),
    enabled: Boolean(user), retry: false, staleTime: 30_000, refetchOnWindowFocus: false,
  });
  const { error, errorUpdatedAt, refetch } = report;
  const { error: optionsError, errorUpdatedAt: optionsErrorAt, refetch: retryOptions } = options;
  useEffect(() => {
    if (error) notifier.error(error.message, { id: "commercial-report-error", action: { label: "Reintentar", onClick: () => { void refetch(); } } });
  }, [error, errorUpdatedAt, refetch]);
  useEffect(() => {
    if (optionsError) notifier.error(optionsError.message, { id: "commercial-report-options-error", action: { label: "Reintentar", onClick: () => { void retryOptions(); } } });
  }, [optionsError, optionsErrorAt, retryOptions]);
  useEffect(() => () => { if (preview?.url) URL.revokeObjectURL(preview.url); }, [preview?.url]);
  const data = !dirty && !report.isFetching && !report.isError ? report.data : undefined;
  const sellers = options.data?.sellers.filter(seller => !filters.branchId || seller.branchId === filters.branchId) || [];
  const update = (next: Partial<ReportFilters>) => setFilters(current => ({ ...current, ...next }));
  const queryReport = () => {
    const invalid = validateReportFilters(filters);
    if (invalid) return notifier.warning(invalid);
    setPage(0);
    setApplied({ ...filters, statuses: [...filters.statuses] });
    if (!dirty) void report.refetch();
  };
  const download = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };
  const pdf = async (mode: "preview" | "download") => {
    if (!data || exporting) return;
    setExporting(true);
    try {
      const blob = await CommercialReportsService.pdf({ ...applied, ...exportOptions });
      const filename = `Reporte-Cotizaciones-${applied.from}-al-${applied.to}.pdf`;
      if (mode === "download") download(blob, filename);
      else { setPdfBlob(blob); setPreview({ url: URL.createObjectURL(blob), filename }); }
    } catch (cause) {
      notifier.error(cause instanceof Error ? cause.message : "No se pudo generar el PDF.");
    } finally { setExporting(false); }
  };
  const reset = () => {
    const defaults = initialReportFilters();
    setFilters(defaults); setApplied(defaults); setPreset("MONTH_TO_DATE"); setPage(0);
  };

  return (
    <Box component="main" sx={{ p: { xs: 1.5, md: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ sm: "center" }} justifyContent="space-between" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}><FileChartColumn size={25} /><Typography component="h2" variant="h5" fontWeight={700}>Reportes</Typography></Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Rendimiento de cotizaciones · El mismo reporte que se envía por WhatsApp, disponible bajo demanda.</Typography>
        </Box>
        {isAdmin && <Button component={RouterLink} to="/report-subscriptions" variant="outlined" startIcon={<CalendarClock size={16} />}>Reportes programados</Button>}
      </Stack>

      <Paper component="section" variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 2 }} flexWrap="wrap">
          <Typography variant="subtitle1" fontWeight={700}>Rendimiento de cotizaciones</Typography>
          <Chip size="small" variant="outlined" label={isSeller ? "Solo mi actividad" : isAdmin ? "Todas las sucursales disponibles" : "Solo mi sucursal"} />
        </Stack>
        <Box component="form" onSubmit={event => { event.preventDefault(); queryReport(); }}>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.5 }}>
            <TextField select size="small" label="Periodo" value={preset} onChange={event => {
              const value = event.target.value; setPreset(value);
              if (value !== "CUSTOM") update(reportPeriod(value, filters.timezone));
            }}>{PERIODS.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            <TextField size="small" type="date" label="Desde" value={filters.from} slotProps={{ inputLabel: { shrink: true } }}
              onChange={event => { setPreset("CUSTOM"); update({ from: event.target.value }); }} />
            <TextField size="small" type="date" label="Hasta" value={filters.to} slotProps={{ inputLabel: { shrink: true } }}
              onChange={event => { setPreset("CUSTOM"); update({ to: event.target.value }); }} />
            <TextField select size="small" label="Zona horaria" value={filters.timezone} onChange={event => {
              const timezone = event.target.value;
              update({ timezone, ...(preset === "CUSTOM" ? {} : reportPeriod(preset, timezone)) });
            }}>{TIMEZONES.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
            {isAdmin ? <TextField select size="small" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} label="Sucursal" value={filters.branchId} disabled={options.isPending || options.isError}
              onChange={event => update({ branchId: event.target.value, sellerId: "" })}>
              <MenuItem value="">Todas las sucursales</MenuItem>
              {options.data?.branches.map(branch => <MenuItem key={branch.id} value={branch.id}>{branch.name}{!branch.isActive ? " (inactiva)" : ""}</MenuItem>)}
            </TextField> : <TextField size="small" label="Sucursal" value={user?.branch.name || ""} slotProps={{ input: { readOnly: true } }} />}
            {isSeller ? <TextField size="small" label="Vendedor" value={`${user?.name || ""} ${user?.lastname || ""}`.trim()} slotProps={{ input: { readOnly: true } }} /> :
              <TextField select size="small" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} label="Vendedor" value={filters.sellerId} disabled={options.isPending || options.isError}
                onChange={event => update({ sellerId: event.target.value })}>
                <MenuItem value="">Todos los vendedores</MenuItem>
                {sellers.map(seller => <MenuItem key={seller.id} value={seller.id}>{seller.name}{!seller.isActive ? " (inactivo)" : ""}</MenuItem>)}
              </TextField>}
            <TextField select size="small" label="Moneda" value={filters.currency} onChange={event => update({ currency: event.target.value as ReportFilters["currency"] })}>
              <MenuItem value="ALL">MXN y USD por separado</MenuItem><MenuItem value="MXN">Pesos (MXN)</MenuItem><MenuItem value="USD">Dólares (USD)</MenuItem>
            </TextField>
            <TextField select size="small" label="Estados" value={filters.statuses}
              slotProps={{ select: { multiple: true, displayEmpty: true, renderValue: value => (value as string[]).length ? (value as string[]).map(status => STATUS_LABELS[status]).join(", ") : "Todos" }, inputLabel: { shrink: true } }}
              onChange={event => { const value = event.target.value; update({ statuses: typeof value === "string" ? value.split(",") : value as string[] }); }}>
              {Object.entries(STATUS_LABELS).map(([value, label]) => <MenuItem key={value} value={value}><Checkbox size="small" checked={filters.statuses.includes(value)} />{label}</MenuItem>)}
            </TextField>
            <TextField select size="small" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} label="Canal" value={filters.sourceChannel} onChange={event => update({ sourceChannel: event.target.value })}>
              <MenuItem value="">Todos los canales</MenuItem>{Object.entries(CHANNEL_LABELS).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
            </TextField>
            <TextField select size="small" slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }} label="Captura" value={filters.captureMethod} onChange={event => update({ captureMethod: event.target.value })}>
              <MenuItem value="">Todas</MenuItem><MenuItem value="SYSTEM">En el sistema</MenuItem><MenuItem value="EXCEL_IMPORT">Importada de Excel</MenuItem>
            </TextField>
            <FormControlLabel sx={{ m: 0 }} control={<Switch size="small" checked={filters.compare} onChange={(_, compare) => update({ compare })} />}
              label={<Typography variant="body2">Comparar con periodo anterior</Typography>} />
            <Stack direction="row" alignItems="center" gap={1}>
              <Button type="submit" variant="contained" startIcon={<Search size={16} />} disabled={report.isFetching || exporting}>Consultar</Button>
              <Button onClick={reset} disabled={exporting}>Restablecer</Button>
            </Stack>
          </Box>
        </Box>
      </Paper>
      <Alert severity="info">Actividad del cotizador, no ventas facturadas de Proscai. Se considera una versión por familia de cotización dentro del periodo; los importes incluyen impuestos y se separan por moneda.</Alert>
      {options.isError && <Alert severity="warning" action={<Button onClick={() => void options.refetch()}>Reintentar</Button>}>No se cargaron las opciones de los filtros.</Alert>}
      {dirty && <Alert severity="warning">Hay filtros sin aplicar. Pulsa Consultar para generar el reporte con estos criterios.</Alert>}
      {report.isFetching && <LinearProgress aria-label="Generando reporte" />}
      {!dirty && report.isError && <Alert severity="error" action={<Button onClick={() => void report.refetch()}>Reintentar</Button>}>{report.error.message}</Alert>}
      {data && <>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" gap={2}>
          <Box><Typography variant="subtitle2">{data.scopeName}</Typography><Typography variant="caption" color="text.secondary">
            {data.periodFrom} al {data.periodTo} · Consultado {new Date(data.generatedAt).toLocaleString("es-MX", { timeZone: data.timezone })}
          </Typography></Box>
          <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
            <Button variant="outlined" size="small" startIcon={<RefreshCw size={15} />} disabled={exporting} onClick={() => void report.refetch()}>Actualizar</Button>
            <Button variant="outlined" size="small" startIcon={<Eye size={15} />} disabled={exporting} onClick={() => void pdf("preview")}>Vista previa PDF</Button>
            <Button variant="contained" size="small" startIcon={<Download size={15} />} disabled={exporting} onClick={() => void pdf("download")}>{exporting ? "Generando PDF…" : "Descargar PDF"}</Button>
          </Stack>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} gap={1}>
          <FormControlLabel control={<Checkbox size="small" checked={exportOptions.includeBreakdowns} onChange={(_, includeBreakdowns) => setExportOptions(current => ({ ...current, includeBreakdowns }))} />}
            label={<Typography variant="body2">PDF con desgloses</Typography>} />
          <FormControlLabel control={<Checkbox size="small" checked={exportOptions.includeDetails} onChange={(_, includeDetails) => setExportOptions(current => ({ ...current, includeDetails }))} />}
            label={<Typography variant="body2">PDF con detalle de cotizaciones (hasta 1,000)</Typography>} />
        </Stack>
        <ReportMetrics data={data} />
        {!data.details.total && <Alert severity="info">No hay cotizaciones para el periodo y los filtros seleccionados.</Alert>}
        <Paper variant="outlined" sx={{ minWidth: 0, overflow: "hidden" }}>
          <Tabs value={tab} onChange={(_, value: string) => setTab(value)} variant="scrollable" scrollButtons="auto">
            <Tab value="summary" label="Resumen" /><Tab value="sellers" label="Vendedores" /><Tab value="branches" label="Sucursales" /><Tab value="customers" label="Clientes" /><Tab value="quotes" label={`Cotizaciones (${count(data.details.total)})`} />
          </Tabs>
          <Divider />
          {tab === "summary" && <Box sx={{ p: 2, display: "grid", gap: 2 }}>
            <GroupTable title="Por estado" rows={data.breakdowns.statuses} />
            <GroupTable title="Por canal" rows={data.breakdowns.channels} />
            <GroupTable title="Por forma de captura" rows={data.breakdowns.captureMethods} />
          </Box>}
          {tab === "sellers" && <GroupTable title="Actividad por vendedor" rows={data.sellers.map(seller => ({ ...seller, id: seller.userId, created: seller.quotes, orders: 0 }))} />}
          {tab === "branches" && <GroupTable title="Actividad por sucursal" rows={data.breakdowns.branches} />}
          {tab === "customers" && <GroupTable title="Actividad por cliente" rows={data.breakdowns.customers} />}
          {tab === "quotes" && <>
            <QuoteTable rows={data.details.items} timezone={data.timezone} />
            <TablePagination component="div" count={data.details.total} page={data.details.page - 1} rowsPerPage={pageSize} rowsPerPageOptions={[10, 25, 50, 100]}
              labelRowsPerPage="Por página" labelDisplayedRows={({ from, to, count: total }) => `${from}–${to} de ${total}`}
              onPageChange={(_, value) => setPage(value)} onRowsPerPageChange={event => { setPageSize(Number(event.target.value)); setPage(0); }} />
          </>}
        </Paper>
      </>}
      <Dialog open={Boolean(preview)} onClose={() => { setPreview(null); setPdfBlob(null); }} fullWidth maxWidth="xl">
        <DialogTitle>Vista previa del reporte</DialogTitle>
        <DialogContent sx={{ p: 0, height: "75vh" }}>{preview && <Box component="iframe" title="Reporte de cotizaciones PDF" src={preview.url} sx={{ width: "100%", height: "100%", border: 0 }} />}</DialogContent>
        <DialogActions>
          {preview && pdfBlob && <Button startIcon={<Download size={16} />} onClick={() => download(pdfBlob, preview.filename)}>Descargar</Button>}
          <Button onClick={() => { setPreview(null); setPdfBlob(null); }}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function ReportMetrics({ data }: { data: CommercialReport }) {
  const metrics = [
    ["Generadas", "created"], ["Cotizadas", "quoted"], ["Aprobadas", "approved"], ["Pendientes", "pending"], ["Pedidos", "ordersGenerated"],
  ] as const;
  return <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(5, minmax(0, 1fr))" }, gap: 1.5 }}>
    {metrics.map(([label, key]) => {
      const previous = data.comparison?.totals[key];
      const delta = previous === undefined ? null : data.totals[key] - previous;
      return <Paper key={key} variant="outlined" sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
        <Typography variant="h4" fontWeight={700}>{count(data.totals[key])}</Typography>
        {delta !== null && <Typography variant="caption" color="text.secondary">{delta > 0 ? "+" : ""}{count(delta)} vs. anterior ({count(previous!)})</Typography>}
      </Paper>;
    })}
    <Paper variant="outlined" sx={{ p: 2, gridColumn: { sm: "span 2", lg: "span 2" } }}>
      <Typography variant="subtitle2">Importes en pesos · MXN</Typography>
      <Typography variant="body2">Cotizado: <strong>{money(data.totals.quotedMxn, "MXN")}</strong></Typography>
      <Typography variant="body2">Aprobado: <strong>{money(data.totals.approvedMxn, "MXN")}</strong></Typography>
      <Typography variant="body2">Pedidos: <strong>{money(data.orderMxn, "MXN")}</strong></Typography>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2, gridColumn: { sm: "span 2", lg: "span 2" } }}>
      <Typography variant="subtitle2">Importes en dólares · USD</Typography>
      <Typography variant="body2">Cotizado: <strong>{money(data.totals.quotedUsd, "USD")}</strong></Typography>
      <Typography variant="body2">Aprobado: <strong>{money(data.totals.approvedUsd, "USD")}</strong></Typography>
      <Typography variant="body2">Pedidos: <strong>{money(data.orderUsd, "USD")}</strong></Typography>
    </Paper>
    <Paper variant="outlined" sx={{ p: 2 }}><Typography variant="body2" color="text.secondary">Aprobadas / generadas</Typography><Typography variant="h4" fontWeight={700}>{data.approvalRate}%</Typography>
      {data.comparison && <Typography variant="caption" color="text.secondary">Anterior: {data.comparison.periodFrom} al {data.comparison.periodTo}</Typography>}
    </Paper>
  </Box>;
}

function GroupTable({ title, rows }: { title: string; rows: ReportGroup[] }) {
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const safePage = Math.min(page, Math.max(0, Math.ceil(rows.length / size) - 1));
  const visible = rows.slice(safePage * size, (safePage + 1) * size);
  return <Box sx={{ minWidth: 0 }}><Typography component="h2" variant="subtitle2" sx={{ p: 1.5 }}>{title}</Typography>
    <TableContainer sx={{ maxHeight: 450 }}><Table stickyHeader size="small" aria-label={title} sx={{ minWidth: 900 }}>
      <TableHead sx={tableHead}><TableRow>{["Nombre", "Generadas", "Aprobadas", "Aprobación", "Cotizado MXN", "Cotizado USD", "Aprobado MXN", "Aprobado USD"].map((label, i) => <TableCell key={label} align={i ? "right" : "left"}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{visible.map(row => <TableRow key={row.id} hover>
        <TableCell sx={{ minWidth: 180, maxWidth: 300, fontSize: 12 }}>{row.name}</TableCell>
        <TableCell align="right" sx={columnStyle}>{count(row.created)}</TableCell>
        <TableCell align="right" sx={columnStyle}>{count(row.approved)}</TableCell>
        <TableCell align="right" sx={columnStyle}>{row.created ? (100 * row.approved / row.created).toFixed(1) : "0.0"}%</TableCell>
        <TableCell align="right" sx={columnStyle}>{money(row.quotedMxn, "MXN")}</TableCell>
        <TableCell align="right" sx={columnStyle}>{money(row.quotedUsd, "USD")}</TableCell>
        <TableCell align="right" sx={columnStyle}>{money(row.approvedMxn, "MXN")}</TableCell>
        <TableCell align="right" sx={columnStyle}>{money(row.approvedUsd, "USD")}</TableCell>
      </TableRow>)}
        {!rows.length && <TableRow><TableCell colSpan={8}>Sin actividad para estos filtros.</TableCell></TableRow>}
      </TableBody>
    </Table></TableContainer>
    {rows.length > 25 && <TablePagination component="div" count={rows.length} page={safePage} rowsPerPage={size} rowsPerPageOptions={[10, 25, 50, 100]}
      labelRowsPerPage="Por página" onPageChange={(_, value) => setPage(value)}
      onRowsPerPageChange={event => { setSize(Number(event.target.value)); setPage(0); }} />}
  </Box>;
}
function QuoteTable({ rows, timezone }: { rows: ReportQuoteRow[]; timezone: string }) {
  return <TableContainer sx={{ maxHeight: 600 }}><Table stickyHeader size="small" aria-label="Detalle de cotizaciones" sx={{ minWidth: 1200 }}>
    <TableHead sx={tableHead}><TableRow>{["Folio", "Referencia cliente", "Fecha", "Cliente", "Vendedor", "Sucursal", "Estado", "Canal", "Captura", "Pedido", "Moneda", "Total"].map(label => <TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
    <TableBody>{rows.map(row => <TableRow key={row.id} hover>
      <TableCell sx={columnStyle}><Button component={RouterLink} to={`/quotes/${row.id}`} size="small" sx={{ whiteSpace: "nowrap", textTransform: "none" }}>{row.quoteNumber}</Button></TableCell>
      <TableCell sx={columnStyle}>{row.customerReference || "—"}</TableCell>
      <TableCell sx={columnStyle}>{new Date(row.createdAt).toLocaleDateString("es-MX", { timeZone: timezone })}</TableCell>
      <TableCell sx={{ minWidth: 170, fontSize: 12 }}>{row.customerName}</TableCell><TableCell sx={columnStyle}>{row.sellerName}</TableCell><TableCell sx={columnStyle}>{row.branchName}</TableCell>
      <TableCell sx={columnStyle}>{STATUS_LABELS[row.status] || row.status}</TableCell><TableCell sx={columnStyle}>{CHANNEL_LABELS[row.sourceChannel] || row.sourceChannel}</TableCell>
      <TableCell sx={columnStyle}>{row.captureMethod === "SYSTEM" ? "Sistema" : "Excel"}</TableCell><TableCell sx={columnStyle}>{row.orderGenerated ? "Generado" : "Sin generar"}</TableCell>
      <TableCell sx={columnStyle}>{row.currency}</TableCell><TableCell sx={columnStyle} align="right">{money(row.total, row.currency)}</TableCell>
    </TableRow>)}{!rows.length && <TableRow><TableCell colSpan={12}>Sin cotizaciones para estos filtros.</TableCell></TableRow>}</TableBody>
  </Table></TableContainer>;
}
