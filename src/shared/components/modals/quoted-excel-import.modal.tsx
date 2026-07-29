import { AlertCircle, FileSpreadsheet, Loader2, X } from "lucide-react";
import { useState } from "react";
import { QuoteExtractionJobsService } from "../../../modules/quote-extraction/services/quote-extraction-jobs.service";
import type { ExtractedQuotedExcelItem } from "../../../modules/quote-extraction/types/quote-extraction-job.types";
import { useManualQuoteStore } from "../../../store/quote/manual-quote.store";
import { AttachmentsService } from "../../../modules/attachments/services/attachments.service";

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
  const setItems = useManualQuoteStore((state) => state.setItemsFromQuotedExcel);
  const addItems = useManualQuoteStore((state) => state.addItemsFromQuotedExcel);
  const [file, setFile] = useState<File | null>(null);
  const [items, setExtractedItems] = useState<ExtractedQuotedExcelItem[] | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attachmentId, setAttachmentId] = useState<string | null>(null);

  if (!open) return null;

  const close = (keepAttachment = false) => {
    if (processing) return;
    if (!keepAttachment && attachmentId) void AttachmentsService.delete(attachmentId).catch(() => undefined);
    setFile(null);
    setExtractedItems(null);
    setProgress(0);
    setStatus("");
    setError(null);
    setAttachmentId(null);
    onClose();
  };

  const patchItem = (index: number, patch: Partial<ExtractedQuotedExcelItem>) => {
    setExtractedItems((current) => current?.map((item, itemIndex) => (
      itemIndex === index ? { ...item, ...patch, requiere_revision: false } : item
    )) ?? null);
  };

  const processFile = async () => {
    if (!file || processing) return;

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

      const extracted = result.result?.items ?? [];
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
    if (!items?.length) return;
    if (mode === "append") addItems(items);
    else setItems(items);
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
            <p className="mt-1 text-sm text-gray-500">Se extraerán únicamente descripción, unidad, cantidad, precio y tiempo de entrega.</p>
          </div>
          <button onClick={() => close()} disabled={processing} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          {!items && (
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
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-[980px] divide-y divide-gray-200 text-xs">
                <thead className="bg-gray-50 text-left font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-3 py-2">Descripción</th>
                    <th className="px-3 py-2">UM</th>
                    <th className="px-3 py-2">Cantidad</th>
                    <th className="px-3 py-2">Precio unitario</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Entrega</th>
                    <th className="px-3 py-2">Revisión</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((item, index) => (
                    <tr key={`${index}-${item.description_original}`}>
                      <td className="min-w-80 px-3 py-2">
                        <textarea value={item.description_normalizada} rows={2} onChange={(event) => patchItem(index, { description_normalizada: event.target.value.toUpperCase() })} className="w-full resize-none rounded border border-gray-300 px-2 py-1" />
                      </td>
                      <td className="px-3 py-2"><input value={item.unidad ?? ""} onChange={(event) => patchItem(index, { unidad: event.target.value.toUpperCase() })} className="w-20 rounded border border-gray-300 px-2 py-1" /></td>
                      <td className="px-3 py-2"><input type="number" min="0" value={item.cantidad ?? ""} onChange={(event) => patchItem(index, { cantidad: updateNumber(event.target.value) })} className="w-24 rounded border border-gray-300 px-2 py-1" /></td>
                      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.precio_vendedor ?? ""} onChange={(event) => patchItem(index, { precio_vendedor: updateNumber(event.target.value) })} className="w-28 rounded border border-gray-300 px-2 py-1" /></td>
                      <td className="px-3 py-2"><input type="number" min="0" step="0.01" value={item.subtotal ?? ""} onChange={(event) => patchItem(index, { subtotal: updateNumber(event.target.value) })} className="w-28 rounded border border-gray-300 px-2 py-1" /></td>
                      <td className="px-3 py-2"><input value={item.tiempo_entrega ?? ""} onChange={(event) => patchItem(index, { tiempo_entrega: event.target.value })} className="w-36 rounded border border-gray-300 px-2 py-1" /></td>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${item.requiere_revision ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"}`}>
                          {item.requiere_revision ? "Revisar" : "Lista"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-gray-200 px-5 py-4">
          <button onClick={() => close()} disabled={processing} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50">Cancelar</button>
          {!items ? (
            <button onClick={() => void processFile()} disabled={!file || processing} className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
              {processing && <Loader2 className="h-4 w-4 animate-spin" />}
              {processing ? "Procesando..." : "Procesar cotización"}
            </button>
          ) : currentItemsCount > 0 ? (
            <>
              <button onClick={() => apply("replace")} className="rounded-md border border-amber-400 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50">Sustituir partidas</button>
              <button onClick={() => apply("append")} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Agregar partidas</button>
            </>
          ) : (
            <button onClick={() => apply("replace")} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Cargar partidas</button>
          )}
        </footer>
      </div>
    </div>
  );
};
