import { useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, FormControlLabel, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, Typography,
} from "@mui/material";
import type { ErpEanSuggestion } from "../../modules/procurement/services/purchase-requisitions.service";
import { getBranchNameByCode } from "../../modules/branches/branch.utils";

export const ErpEanSuggestionPanel = ({ suggestion, currentEan, editable, blocked, onApply }: {
  suggestion: ErpEanSuggestion;
  currentEan: string;
  editable: boolean;
  blocked: boolean;
  onApply: (ean: string) => void;
}) => {
  const [reviewed, setReviewed] = useState(false);
  const differentEan = Boolean(currentEan.trim() && currentEan.trim() !== suggestion.candidate);
  const notices = suggestion.notices ?? [];
  return <Box sx={{ display: "grid", gap: 1.5, minWidth: 0 }}>
    <Alert severity={suggestion.canApply ? "info" : "warning"} variant="outlined">
      <Typography variant="body2" fontWeight={700} sx={{ overflowWrap: "anywhere" }}>
        {suggestion.candidate ? `Propuesta: ${suggestion.candidate}` : "Desglose parcial del EAN"}
      </Typography>
      <Typography variant="caption" display="block">Reglas y referencias del catálogo de México. Revisa la propuesta antes de incorporarla a la ficha.</Typography>
      {suggestion.warnings.map((warning) => <Typography key={warning} variant="caption" display="block" sx={{ mt: 0.5 }}>{warning}</Typography>)}
    </Alert>
    {suggestion.missingFields.length > 0 && <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {suggestion.missingFields.map((field) => <Chip key={field} size="small" color="warning" variant="outlined" label={`Confirmar: ${field}`} />)}
    </Box>}
    {suggestion.segments.length > 0 && <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Table size="small" aria-label="Desglose de segmentos EAN">
        <TableHead><TableRow><TableCell>Segmento</TableCell><TableCell>Código</TableCell><TableCell>Evidencia</TableCell></TableRow></TableHead>
        <TableBody>{suggestion.segments.map((segment, index) => <TableRow key={`${segment.label}:${index}`}>
          <TableCell sx={{ fontSize: 12 }}>{segment.label}</TableCell>
          <TableCell sx={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{segment.code}</TableCell>
          <TableCell sx={{ fontSize: 12, overflowWrap: "anywhere" }}>{segment.evidence}</TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </TableContainer>}
    {(suggestion.matches.length > 0 || notices.length > 0) && <Alert severity="info" variant="outlined">
      <Typography variant="body2" fontWeight={600}>Registros ERP con el mismo EAN</Typography>
      {notices.length > 0 ? notices.map((notice) => <Typography key={notice} variant="caption" display="block" sx={{ mt: 0.5 }}>{notice}</Typography>)
        : <Typography variant="caption" display="block">El EAN puede repetirse entre sucursales. Cada producto se identifica por su código ERP (ICOD).</Typography>}
      {suggestion.matches.map((match, index) => <Typography key={`${match.code}:${index}`} variant="caption" display="block" sx={{ mt: 0.5 }}>
        {getBranchNameByCode(match.code.slice(0, 2))} · {match.code} · {match.ean} · {match.description}
      </Typography>)}
    </Alert>}
    <Typography variant="body2" fontWeight={600}>Referencias del catálogo de México</Typography>
    {suggestion.references.length ? <TableContainer sx={{ maxHeight: 260, border: 1, borderColor: "divider", borderRadius: 1 }}>
      <Table stickyHeader size="small" aria-label="Productos ERP de México relacionados">
        <TableHead><TableRow><TableCell>Código / EAN</TableCell><TableCell>Descripción y comparación</TableCell></TableRow></TableHead>
        <TableBody>{suggestion.references.map((reference, index) => <TableRow key={`${reference.code}:${index}`}>
          <TableCell sx={{ verticalAlign: "top", fontSize: 12, overflowWrap: "anywhere", minWidth: 130 }}>
            <Typography variant="caption" fontWeight={700} display="block">{reference.code}</Typography>{reference.ean}
          </TableCell>
          <TableCell sx={{ verticalAlign: "top", fontSize: 12, overflowWrap: "anywhere" }}>
            {reference.description}
            <Typography variant="caption" display="block" color="success.main" sx={{ mt: 0.5 }}>Coincide: {reference.agreements.join(", ") || "Revisión manual"}</Typography>
            {reference.checks.length > 0 && <Typography variant="caption" display="block" color="warning.main">Por confirmar: {reference.checks.join(", ")}</Typography>}
          </TableCell>
        </TableRow>)}</TableBody>
      </Table>
    </TableContainer> : <Typography variant="caption" color="text.secondary">No se encontraron referencias compatibles. Valida los atributos y la nomenclatura con Compras.</Typography>}
    {suggestion.canApply && suggestion.candidate && editable && <Box>
      <FormControlLabel control={<Checkbox size="small" checked={reviewed} disabled={blocked} onChange={(_, checked) => setReviewed(checked)} />}
        label={<Typography variant="caption">Revisé los atributos, las observaciones y las referencias de la propuesta.</Typography>} />
      <Button size="small" variant="outlined" disabled={blocked || !reviewed || differentEan} onClick={() => onApply(suggestion.candidate!)}>
        Usar sugerencia en la ficha
      </Button>
      {differentEan && <Typography variant="caption" display="block">El campo ya tiene un EAN diferente. Bórralo manualmente si deseas usar esta propuesta.</Typography>}
    </Box>}
  </Box>;
};
