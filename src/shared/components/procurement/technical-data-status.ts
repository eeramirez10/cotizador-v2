import type { TechnicalDataFormValue } from "./technical-data-editor";

export const technicalDataStatus = (value: TechnicalDataFormValue): "PENDING" | "COMPLETE" => (
  value.standard.trim()
  || value.diameter.trim()
  || value.thickness.trim()
  || value.bore.trim()
  || Object.values(value.technicalAttributes).some((entry) => entry.trim())
) ? "COMPLETE" : "PENDING";
