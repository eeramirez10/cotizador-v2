import { AlertCircle, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useState } from "react";
import { QuoteExtractionJobsService } from "../../../modules/quote-extraction/services/quote-extraction-jobs.service";
import type { ExtractedQuotedExcelItem } from "../../../modules/quote-extraction/types/quote-extraction-job.types";
import { useManualQuoteStore, type QuoteCurrency } from "../../../store/quote/manual-quote.store";
import { AttachmentsService } from "../../../modules/attachments/services/attachments.service";
import { MEASUREMENT_UNIT_OPTIONS, normalizeMeasurementUnit } from "../../../modules/products/constants/measurement-units";
import {
  getQuotedExcelReviewIssues,
  normalizeAndReviewQuotedExcelItem,
  type QuotedExcelReviewField,
} from "../../../modules/quote-extraction/utils/quoted-excel-review";

interface QuotedExcelImportModalProps {
  open: boolean;
  onClose: () => void;
  onCompleted: (itemsCount: number) => void;
}

const updateNumber = (rawValue: string): number | null => {
  if (!rawValue.trim()) return null;
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
};

export const QuotedExcelImportModal = ({ open, onClose, onCompleted }: QuotedExcelImportModalProps) => {
  const currentItemsCount = useManualQuoteStore((state) => state.draft.items.length);
  const clientDraftId = useManualQuoteStore((state) => state.draft.id);
  const lockedImportCurrency = useManualQuoteStore((state) => (
    state.draft.captureMethod === "EXCEL_IMPORT" ? state.draft.currency : null
  ));
  const setItems = useManualQuoteStore((state) => state.setItemsFromQuotedExcel);
  const addItems = useManualQuoteStore((state) => state.addItemsFromQuotedExcel);
  const [file, setFile] = useState<File | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState<QuoteCurrency | "">("");
  const [items, setExtractedItems] = useState<ExtractedQuotedExcelItem[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const importCurrency = lockedImportCurrency || selectedCurrency;
  const pendingReviewCount = items?.filter((item) => getQuotedExcelReviewIssues(item).length > 0).length ?? 0;
  const reviewIssueCount = items?.reduce((total, item) => total + getQuotedExcelReviewIssues(item).length, 0) ?? 0;
  const hasPendingReview = pendingReviewCount > 0;

  if (!open) return null;

  const close = (keepAttachment = false) => {
    if (processing) return;
    if (!keepAttachment && attachmentId) void AttachmentsService.delete(attachmentId).catch(() => undefined);
    setFile(null);
    setSelectedCurrency("");
    setExtractedItems(null);
    setProgress(0);
    setStatus("");
    setError(null);
    setAttachmentId(null);
    onClose();
  };

  const patchItem = (index: number, patch: Partial<ExtractedQuotedExcelItem>) => {
    setExtractedItems((current) => current?.map((item, itemIndex) => (
      itemIndex === index
        ? (() => {
            return normalizeAndReviewQuotedExcelItem({ ...item, ...patch }, false);
          })()
        : item
    )) ?? null);
  };

  const processFile = async () => {
    if (!file || processing) return;
    if (!importCurrency) {
      setError("Selecciona la moneda en la que fue elaborada la cotización.");
      return;
    }

    let uploadedAttachmentId: string | null = null;
    try {
      setProcessing(true);
      setError(null);
      setProgress(5);
      setStatus("Subiendo cotización Excel...");
      const attachment = await AttachmentsService.uploadQuoteSource(clientDraftId, file);
      uploadedAttachmentId = attachment.id;
      setAttachmentId(attachment.id);
      const job = await QuoteExtractionJobsService.createQuotedExcelJob(file);
      setProgress(10);
      setStatus("Extrayendo partidas y precios...");

      const result = await QuoteExtractionJobsService.waitForQuotedExcelCompletion(job.job_id, {
        onStatus: (jobStatus) => {
          setProgress(Math.max(10, Math.min(100, jobStatus.progress || 0)));
          if (jobStatus.status === "queued") setStatus("En cola de procesamiento...");
          if (jobStatus.status === "processing") setStatus("Leyendo columnas de la cotización...");
          if (jobStatus.status === "completed") setStatus("Extracción completada.");
        },
      });

      const extracted = (result.result?.items ?? []).map((item) =>
        normalizeAndReviewQuotedExcelItem({ ...item, moneda: item.moneda ?? null })
      );
      if (extracted.length === 0) {
        throw new Error("No se encontraron partidas en el archivo Excel.");
      }

      setExtractedItems(extracted);
      setProgress(100);
      setStatus(`Se encontraron ${extracted.length} partidas. Revisa los datos antes de agregarlas.`);
    } catch (caught) {
      if (uploadedAttachmentId) {
        await AttachmentsService.delete(uploadedAttachmentId).catch(() => undefined);
        setAttachmentId(null);
      }
      setError(caught instanceof Error ? caught.message : "No se pudo procesar la cotización Excel.");
      setStatus("Error durante el procesamiento.");
    } finally {
      setProcessing(false);
    }
  };

  const apply = (mode: "append" | "replace") => {
    if (!items?.length || !importCurrency) return;
    if (mode === "append") addItems(items, importCurrency);
    else setItems(items, importCurrency);
    onCompleted(items.length);
    close(true);
  };

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
              <h3 className="text-base font-semibold text-gray-800">Importar cotización elaborada en Excel</h3>
            </div>
            <p className="mt-1 text-sm text-gray-500">Se extraerán descripción, unidad, cantidad, moneda, precio y tiempo de entrega por partida.</p>
          </div>
          <button onClick={() => close()} disabled={processing} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {!items && (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <label htmlFor="quoted-excel-currency" className="text-xs font-semibold uppercase tracking-wide text-amber-800">
                  Moneda de la cotización Excel *
                </label>
                <select
                  id="quoted-excel-currency"
                  value={importCurrency}
                  disabled={processing || Boolean(lockedImportCurrency)}
                  onChange={(event) => {
                    setSelectedCurrency(event.target.value as QuoteCurrency);
                    setError(null);
                  }}
                  className="mt-2 w-full rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Selecciona MXN o USD</option>
                  <option value="MXN">MXN - Pesos mexicanos</option>
                  <option value="USD">USD - Dólares estadounidenses</option>
                </select>
                <p className="mt-2 text-xs text-amber-800">
                  {lockedImportCurrency
                    ? `Esta cotización ya fue importada en ${lockedImportCurrency}; las partidas adicionales usarán la misma moneda.`
                    : "Elige la moneda final. Las partidas en otra moneda se convertirán usando el tipo de cambio de la cotización."}
                </p>
              </div>

              <div className="rounded-lg border border-dashed border-emerald-300 bg-emerald-50/50 p-5">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  disabled={processing}
                  onChange={(event) => {
                    setFile(event.currentTarget.files?.[0] ?? null);
                    setError(null);
                    setStatus("");
                  }}
                  className="w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-emerald-600 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-emerald-700"
                />
                <p className="mt-3 text-xs text-gray-500">Formatos permitidos: XLSX y XLS. El número de partida y los encabezados serán ignorados.</p>
              </div>
            </div>
          )}

          {(processing || status) && (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">{status || "Procesando..."}</p>
              <div className="mt-2 h-2 overflow-hidden rounded bg-blue-100">
                <div className="h-full rounded bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {items && (
            <>
            {hasPendingReview && (
              <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-semibold">Hay {reviewIssueCount} dato(s) por corregir en {pendingReviewCount} partida(s).</p>
                  <p className="mt-0.5">Los campos están resaltados y la última columna explica exactamente qué debes revisar.</p>
                </div>
              </div>
            )}
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[1280px] divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-left font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Partida</th>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">UM</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Moneda</th>
                    <th className="px-3 py-2">Precio unitario</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Entrega</th>
                    <th className="px-3 py-2">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => {
                    const issues = getQuotedExcelReviewIssues(item);
                    const hasFieldIssue = (field: QuotedExcelReviewField) => issues.some((issue) => issue.field === field);
                    const fieldClass = (field: QuotedExcelReviewField, width: string) =>
                      `${width} rounded border px-2 py-1 outline-none ${hasFieldIssue(field)
                        ? "border-rose-400 bg-rose-50 text-rose-900 focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                        : "border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`;
                    const normalizedUnit = normalizeMeasurementUnit(item.unidad);
                    const unitValue = normalizedUnit ?? item.unidad?.trim().toUpperCase() ?? "";

                    return (
                    <tr key={`${index}-${item.description_original}`} className={issues.length > 0 ? "bg-amber-50/30" : undefined}>
                      <td className="px-3 py-2 text-center align-top">
                        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${issues.length > 0 ? "bg-amber-200 text-amber-900" : "bg-slate-100 text-slate-600"}`}>
                          {index + 1}
                        </span>
                      </td>
                      <td className="min-w-80 px-3 py-2">
                        <textarea value={item.description_normalizada} rows={2} onChange={(event) => patchItem(index, { description_normalizada: event.target.value.toUpperCase() })} className={`${fieldClass("description_normalizada", "w-full")} resize-none`} />
                      </td>
                      <td className="px-3 py-2">
                        <select value={unitValue} onChange={(event) => patchItem(index, { unidad: event.target.value || null })} className={fieldClass("unidad", "w-28")}>
                          <option value="">Seleccionar</option>
                          {!normalizedUnit && unitValue && <option value={unitValue}>{unitValue} (revisar)</option>}
                          {MEASUREMENT_UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" min="0" value={item.cantidad ?? ""} onChange={(event) => patchItem(index, { cantidad: updateNumber(event.target.value) })} className={fieldClass("cantidad", "w-24")} /></td>
                      <td className="px-3 py-2">
                        <select value={item.moneda ?? ""} onChange={(event) => patchItem(index, { moneda: (event.target.value || null) as QuoteCurrency | null })} className={fieldClass("moneda", "w-24")}>
                          <option value="">Revisar</option>
                          <option value="MXN">MXN</option>
                          <option value="USD">USD</option>
                        </select>
                      </td>
                      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.precio_vendedor ?? ""} onChange={(event) => patchItem(index, { precio_vendedor: updateNumber(event.target.value) })} className={fieldClass("precio_vendedor", "w-28")} /></td>
                      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.subtotal ?? ""} onChange={(event) => patchItem(index, { subtotal: updateNumber(event.target.value) })} className={fieldClass("subtotal", "w-28")} /></td>
                      <td className="px-3 py-2"><input value={item.tiempo_entrega ?? ""} onChange={(event) => patchItem(index, { tiempo_entrega: event.target.value })} className={fieldClass("tiempo_entrega", "w-36")} /></td>
                      <td className="min-w-64 px-3 py-2 align-top">
                        {issues.length > 0 ? (
                          <div className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] leading-4 text-amber-900">
                            <p className="font-bold uppercase tracking-wide">Partida {index + 1} · Revisar</p>
                            <ul className="mt-1 list-disc pl-4">
                              {issues.map((issue) => <li key={issue.code}>{issue.message}</li>)}
                            </ul>
                          </div>
                        ) : (
                          <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700">Lista</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button onClick={() => close()} disabled={processing} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          {!items ? (
            <button onClick={() => void processFile()} disabled={!file || !importCurrency || processing} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {processing && <Loader2 className="h-4 w-4 animate-spin" />}
              {processing ? "Procesando..." : "Procesar cotización"}
            </button>
          ) : currentItemsCount > 0 ? (
            <>
              <button onClick={() => apply("replace")} disabled={hasPendingReview} className="rounded-md border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-50">Sustituir partidas</button>
              <button onClick={() => apply("append")} disabled={hasPendingReview} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Agregar partidas</button>
            </>
          ) : (
            <button onClick={() => apply("replace")} disabled={hasPendingReview} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">Cargar partidas</button>
          )}
        </footer>
      </div>
    </div>
  );
};
