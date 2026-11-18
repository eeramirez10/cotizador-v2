import { useQuery } from "@tanstack/react-query";
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Paper, Stack, Typography } from "@mui/material";
import { Link } from "react-router";
import { useAuthStore } from "../../../store/auth/auth.store";
import { normalizeMeasurementUnit } from "../constants/measurement-units";
import { LocalProductsService, type LocalProductErpLink } from "../services/local-products.service";

type Props = {
  productId: string;
  onClose: () => void;
} & ({ description: string; quote?: never } | {
  description: string;
  quote: { branchId: string; unit: string; onSelect: (link: LocalProductErpLink) => void };
});

export const erpLinkUnitMatches = (left: string, right: string) => {
  const normalize = (unit: string) => normalizeMeasurementUnit(unit) ?? unit.trim().toUpperCase();
  return Boolean(left.trim() && right.trim() && normalize(left) === normalize(right));
};

export function ProductErpLinksDialog({ productId, description, quote, onClose }: Props) {
  const user = useAuthStore(state => state.user);
  const query = useQuery({
    queryKey: ["local-products", "erp-links", productId, user?.id, user?.branchId, !quote],
    queryFn: ({ signal }) => LocalProductsService.getErpLinks(productId, !quote, signal),
  });
  const links = (query.data?.links || []).filter(link => !quote || link.branch.id === quote.branchId);

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Códigos ERP por sucursal</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">{description}</Typography>
          {query.isPending && <CircularProgress size={22} aria-label="Consultando vínculos ERP" />}
          {query.isError && <Alert severity="error" action={<Button color="inherit" onClick={() => void query.refetch()}>Reintentar</Button>}>{query.error.message}</Alert>}
          {query.isSuccess && !links.length && <Alert severity="info">
            {quote ? "No hay un código verificado para esta sucursal. Puedes seguir cotizando el producto local." :
              "No hay códigos verificados en las sucursales que puedes consultar. El producto permanece local."}
          </Alert>}
          {links.map(link => {
            const unitMatches = !quote || erpLinkUnitMatches(quote.unit, link.erpUnit);
            return <Paper variant="outlined" key={link.branch.id} sx={{ p: 1.5 }}>
              <Typography variant="subtitle2">{link.branch.name} · {link.erpCode}</Typography>
              <Typography variant="body2">{link.erpDescription}</Typography>
              <Typography variant="caption" color="text.secondary">
                Unidad: {link.erpUnit} · EAN: {link.erpEan || "—"} · Verificado {new Date(link.verifiedAt).toLocaleDateString("es-MX")}
              </Typography>
              {quote && <Stack spacing={1} sx={{ mt: 1 }}>
                {!unitMatches && <Alert severity="warning">La unidad ERP no coincide con {quote.unit}. No se convertirán cantidades ni precios.</Alert>}
                <Button variant="outlined" size="small" disabled={!unitMatches} onClick={() => quote.onSelect(link)}>Usar código ERP</Button>
              </Stack>}
            </Paper>;
          })}
          {!quote && query.isSuccess && <>
            <Typography variant="subtitle2">Requisiciones relacionadas</Typography>
            <Typography variant="body2" color="text.secondary">
              Compras confirma el código desde la partida de una requisición, después de que el cliente aprueba la cotización.
            </Typography>
            {query.data.requisitions.map(req => (
              <Button key={req.itemId} component={Link} to={`/procurement/${req.id}/items/${req.itemId}`} sx={{ justifyContent: "flex-start" }}>
                {req.number} · {req.branchName}{req.quoteStatus === "APPROVED" ? " · Aprobada" : ""}
              </Button>
            ))}
            {!query.data.requisitions.length && <Typography variant="body2" color="text.secondary">No hay requisiciones visibles para este material.</Typography>}
          </>}
        </Stack>
      </DialogContent>
      <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
    </Dialog>
  );
}
