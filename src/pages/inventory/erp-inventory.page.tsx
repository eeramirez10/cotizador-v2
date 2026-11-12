import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Box, Button, Chip, CircularProgress, LinearProgress, MenuItem, Paper, Stack, Table,
  TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TableSortLabel,
  TextField, Typography } from "@mui/material";
import { RefreshCw, Search, Warehouse } from "lucide-react";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { ErpInventoryService, normalizeInventorySearch, type InventoryFilters, type InventorySort } from "../../modules/inventory/erp-inventory.service";
import { notifier } from "../../shared/notifications/notifier";

const initialFilters: InventoryFilters = { query: "", warehouseCode: "", stock: "all", page: 1, pageSize: 25, sortBy: "code", sortDirection: "asc" };
const columns: Array<{ key: InventorySort; label: string }> = [
  { key: "ean", label: "EAN" }, { key: "code", label: "Código ERP" }, { key: "description", label: "Descripción" },
  { key: "unit", label: "Unidad" }, { key: "warehouseCode", label: "Almacén" }, { key: "stock", label: "Existencia" },
];
const stockFormat = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 3 });

export const ErpInventoryPage = () => {
  const [filters, setFilters] = useState(initialFilters);
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeInventorySearch(search);
  const debouncedSearch = useDebouncedValue(normalizedSearch, 400);
  const searchChanging = normalizedSearch !== debouncedSearch;
  const params = { ...filters, query: debouncedSearch };
  const inventory = useQuery({
    queryKey: ["erp-inventory", params], queryFn: ({ signal }) => ErpInventoryService.list(params, signal),
    enabled: !searchChanging, retry: false, refetchOnWindowFocus: false,
  });
  const warehouses = useQuery({
    queryKey: ["erp-inventory-warehouses"], queryFn: ({ signal }) => ErpInventoryService.warehouses(signal),
    retry: false, staleTime: 30_000, refetchOnWindowFocus: false,
  });
  const { error, errorUpdatedAt, refetch } = inventory;
  const { error: warehouseError, errorUpdatedAt: warehouseErrorUpdatedAt, refetch: refetchWarehouses } = warehouses;
  useEffect(() => {
    if (error) notifier.error(error.message, { id: "erp-inventory-error", action: { label: "Reintentar", onClick: () => { void refetch(); } } });
  }, [error, errorUpdatedAt, refetch]);
  useEffect(() => {
    if (warehouseError) notifier.error(warehouseError.message, { id: "erp-inventory-warehouses-error", action: { label: "Reintentar", onClick: () => { void refetchWarehouses(); } } });
  }, [warehouseError, warehouseErrorUpdatedAt, refetchWarehouses]);
  const result = !searchChanging && !inventory.isFetching && !inventory.isError ? inventory.data : undefined;
  const invalidWarehouse = filters.warehouseCode && warehouses.isSuccess && !warehouses.data.some(({ code }) => code === filters.warehouseCode);
  if (invalidWarehouse) {
    setFilters({ ...filters, warehouseCode: "", page: 1 });
  } else if (result && result.page === filters.page && result.page > Math.max(1, result.totalPages)) {
    setFilters({ ...filters, page: 1 });
  }
  const busy = searchChanging || inventory.isFetching || inventory.isPending;
  const changeFilter = (update: Partial<InventoryFilters>) => setFilters(current => ({ ...current, ...update, page: 1 }));
  const sort = (key: InventorySort) => changeFilter({ sortBy: key,
    sortDirection: filters.sortBy === key && filters.sortDirection === "asc" ? "desc" : "asc" });

  return (
    <Box component="main" sx={{ p: { xs: 2, md: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" gap={2}>
        <Box>
          <Stack direction="row" alignItems="center" gap={1}>
            <Warehouse size={24} aria-hidden="true" />
            <Typography component="h2" variant="h5" fontWeight={700}>Inventario ERP</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Materiales y existencias por almacén, directamente de Proscai.</Typography>
        </Box>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Chip label="Solo consulta" size="small" variant="outlined" />
          <Button variant="outlined" startIcon={<RefreshCw size={16} />} disabled={busy || warehouses.isFetching}
            onClick={() => { void inventory.refetch(); void warehouses.refetch(); }}>Actualizar</Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} gap={2}>
          <TextField label="Buscar por EAN, código o descripción" value={search} size="small" fullWidth
            slotProps={{ htmlInput: { maxLength: 160 }, input: { startAdornment: <Search size={16} aria-hidden="true" style={{ marginRight: 8, flexShrink: 0 }} /> } }}
            onChange={event => { setSearch(event.target.value); changeFilter({}); }} />
          <TextField select label="Almacén" value={warehouses.data?.some(({ code }) => code === filters.warehouseCode) ? filters.warehouseCode : ""} size="small" sx={{ minWidth: { md: 240 } }}
            slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
            disabled={!warehouses.data?.length} onChange={event => changeFilter({ warehouseCode: event.target.value })}>
            <MenuItem value="">Todos los almacenes</MenuItem>
            {(warehouses.data || []).map(warehouse => <MenuItem key={warehouse.code} value={warehouse.code}>{warehouse.code} · {warehouse.name}</MenuItem>)}
          </TextField>
          <TextField select label="Existencia" value={filters.stock} size="small" sx={{ minWidth: { md: 175 } }}
            onChange={event => changeFilter({ stock: event.target.value as InventoryFilters["stock"] })}>
            <MenuItem value="all">Todas</MenuItem><MenuItem value="positive">Positiva</MenuItem>
            <MenuItem value="zero">En cero</MenuItem><MenuItem value="negative">Negativa</MenuItem>
          </TextField>
        </Stack>
      </Paper>
      {warehouses.isError && <Alert severity="warning" action={<Button color="inherit" onClick={() => { void warehouses.refetch(); }}>Reintentar</Button>}>
        {warehouses.data?.length ? "No se pudo actualizar la lista de almacenes. Se conserva la última lista disponible." : "No se cargó la lista de almacenes. Puedes seguir consultando el inventario."}
      </Alert>}

      <Paper variant="outlined" sx={{ overflow: "hidden", borderRadius: 2 }}>
        <Box sx={{ minHeight: 4 }}>{busy && <LinearProgress aria-label="Consultando inventario ERP" />}</Box>
        <TableContainer sx={{ maxHeight: "calc(100dvh - 23rem)", minHeight: 280 }} aria-busy={busy}>
          <Table stickyHeader size="small" aria-label="Existencias por almacén">
            <TableHead><TableRow>{columns.map(column => <TableCell key={column.key} align={column.key === "stock" ? "right" : "left"}
              sortDirection={filters.sortBy === column.key ? filters.sortDirection : false} sx={{ fontWeight: 700, whiteSpace: "nowrap", bgcolor: "grey.50" }}>
              <TableSortLabel active={filters.sortBy === column.key} direction={filters.sortBy === column.key ? filters.sortDirection : "asc"}
                onClick={() => sort(column.key)}>{column.label}</TableSortLabel>
            </TableCell>)}</TableRow></TableHead>
            <TableBody>
              {!result && busy && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8 }}><CircularProgress size={24} aria-label="Cargando existencias" /><Typography variant="body2" sx={{ mt: 1 }}>Consultando existencias…</Typography></TableCell></TableRow>}
              {!busy && inventory.isError && <TableRow><TableCell colSpan={6} sx={{ p: 3 }}><Alert severity="error" action={<Button color="inherit" onClick={() => { void inventory.refetch(); }}>Reintentar</Button>}>{inventory.error.message}</Alert></TableCell></TableRow>}
              {result && result.items.length === 0 && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 8 }}>No se encontraron materiales con estos filtros.</TableCell></TableRow>}
              {result?.items.map(item => <TableRow key={item.id} hover>
                <TableCell sx={{ whiteSpace: "nowrap" }}>{item.ean || "—"}</TableCell>
                <TableCell sx={{ whiteSpace: "nowrap", fontWeight: 600 }}>{item.code || "—"}</TableCell>
                <TableCell sx={{ minWidth: 280, maxWidth: 600, overflowWrap: "anywhere" }}>{item.description || "Sin descripción"}</TableCell>
                <TableCell>{item.unit || "—"}</TableCell>
                <TableCell sx={{ minWidth: 180 }}>{item.warehouseCode ? `${item.warehouseCode} · ${item.warehouseName}` : item.warehouseName}</TableCell>
                <TableCell align="right" sx={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: item.stock === null ? "text.secondary" : item.stock < 0 ? "error.main" : item.stock > 0 ? "success.dark" : "text.secondary" }}>{item.stock === null ? "—" : stockFormat.format(item.stock)}</TableCell>
              </TableRow>)}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination component="div" count={result?.total ?? 0} page={result ? Math.min(filters.page - 1, Math.max(0, result.totalPages - 1)) : 0}
          rowsPerPage={filters.pageSize} rowsPerPageOptions={[10, 25, 50, 100]} labelRowsPerPage="Filas por página"
          labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${stockFormat.format(count)}`}
          onPageChange={(_event, page) => setFilters(current => ({ ...current, page: page + 1 }))}
          onRowsPerPageChange={event => changeFilter({ pageSize: Number(event.target.value) })}
          slotProps={{ actions: { nextButton: { disabled: busy || !result || filters.page >= result.totalPages, "aria-label": "Página siguiente" }, previousButton: { disabled: busy || filters.page <= 1, "aria-label": "Página anterior" } } }}
          sx={{ "& .MuiTablePagination-toolbar": { flexWrap: "wrap", justifyContent: "flex-end", px: 1 } }} />
      </Paper>
      <Typography variant="caption" color="text.secondary" aria-live="polite">
        {result ? `Última consulta: ${new Date(result.fetchedAt).toLocaleString("es-MX")}. ` : ""}
        La consulta respeta los almacenes habilitados en Configuración. No modifica inventarios ni permisos de cotización.
      </Typography>
    </Box>
  );
};
