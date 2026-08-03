import { Loader2 } from "lucide-react";
import { Navigate } from "react-router";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { ManualQuotePage } from "./manual-quote.page";

export const ExcelImportQuotePage = () => {
  const capabilities = useSystemCapabilities();
  if (capabilities.isLoading) {
    return <div className="flex min-h-64 items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />Consultando configuración...</div>;
  }
  if (capabilities.data?.sellerExcelImportEnabled === false) {
    return <Navigate to="/cotizador/sistema" replace />;
  }
  return <ManualQuotePage entryMode="EXCEL_IMPORT" />;
};
