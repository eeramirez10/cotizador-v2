import { AutoAwesomeOutlined, ExpandMoreOutlined } from "@mui/icons-material";
import { Button, Checkbox, FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent, TableCell, TableRow } from "@mui/material";
import type { QuoteCatalogOption } from "../../../modules/quote-catalogs/services/quote-catalogs.service";
import { TechnicalDataEditor, type TechnicalDataFormValue } from "../procurement/technical-data-editor";
import { compactFieldSx } from "./supplier-offer-line-styles";

const optionValue = (option: QuoteCatalogOption) => option.value || option.label;

export const SupplierRestrictionSelect = ({ value, options, onChange, id = "supplier-restrictions", label = "Restricción", required = false }: {
  value: string[];
  options: QuoteCatalogOption[];
  onChange: (value: string[]) => void;
  id?: string;
  label?: string;
  required?: boolean;
}) => {
  const noRestriction = options.find((option) => option.code === "NO_RESTRICTION");
  const noRestrictionValue = noRestriction ? optionValue(noRestriction) : "SIN RESTRICCIÓN";
  const handleChange = (event: SelectChangeEvent<string[]>) => {
    const next = typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value;
    const added = next.find((entry) => !value.includes(entry));
    onChange(added === noRestrictionValue ? [noRestrictionValue] : next.filter((entry) => entry !== noRestrictionValue));
  };
  return <FormControl size="small" required={required} sx={{ ...compactFieldSx, minWidth: 130, maxWidth: 185 }}>
    <InputLabel id={`${id}-label`}>{label}</InputLabel>
    <Select labelId={`${id}-label`} id={id} multiple value={value} label={label} onChange={handleChange} renderValue={(selected) => selected.length ? selected.join(", ") : "Sin indicar"}>
      {!noRestriction && <MenuItem value={noRestrictionValue} sx={{ fontSize: 11 }}><Checkbox size="small" checked={value.includes(noRestrictionValue)} />Sin restricción</MenuItem>}
      {options.map((option) => <MenuItem key={option.id} value={optionValue(option)} sx={{ fontSize: 11 }}><Checkbox size="small" checked={value.includes(optionValue(option))} />{option.label}</MenuItem>)}
    </Select>
  </FormControl>;
};

export const SupplierTechnicalCell = ({ value, onExpand, onSuggest, suggesting, disabled = false, reviewRequired = false }: {
  value: TechnicalDataFormValue;
  onExpand: () => void;
  onSuggest: () => void;
  suggesting: boolean;
  disabled?: boolean;
  reviewRequired?: boolean;
}) => {
  const summary = [value.standard, value.diameter, value.thickness, value.bore, ...Object.values(value.technicalAttributes)].filter(Boolean).join(" · ");
  return <TableCell sx={{ minWidth: 155, maxWidth: 230 }}>
    <div className="flex flex-col gap-1">
      <span className="line-clamp-2 text-[10px] text-slate-600">{summary || "Sin datos técnicos"}</span>
      {reviewRequired && <span className="text-[10px] font-semibold text-amber-800">Revisar sugerencia de IA</span>}
      <Button type="button" size="small" variant="outlined" onClick={onExpand} endIcon={<ExpandMoreOutlined sx={{ fontSize: 13 }} />} sx={{ minHeight: 25, py: 0, px: 0.75, fontSize: 10, textTransform: "none", justifyContent: "space-between" }}>Datos técnicos</Button>
      <Button type="button" size="small" variant="text" disabled={suggesting || disabled} onClick={onSuggest} startIcon={<AutoAwesomeOutlined sx={{ fontSize: 13 }} />} sx={{ minHeight: 24, py: 0, px: 0.5, fontSize: 10, textTransform: "none", whiteSpace: "nowrap" }}>{suggesting ? "Completando..." : "Completar con IA"}</Button>
    </div>
  </TableCell>;
};

export const SupplierTechnicalRow = ({ colSpan, value, onChange, open, reviewRequired = false, onConfirm }: {
  colSpan: number;
  value: TechnicalDataFormValue;
  onChange: (value: TechnicalDataFormValue) => void;
  open: boolean;
  reviewRequired?: boolean;
  onConfirm?: () => void;
}) => !open ? null : <TableRow><TableCell colSpan={colSpan} sx={{ py: 1, backgroundColor: "grey.50" }}><TechnicalDataEditor compact value={value} onChange={onChange} />{reviewRequired && <Button type="button" size="small" variant="contained" onClick={onConfirm} sx={{ mt: 1, fontSize: 10, textTransform: "none" }}>Confirmar datos técnicos revisados</Button>}</TableCell></TableRow>;
