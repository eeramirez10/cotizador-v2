import { AlertCircle, FileSpreadsheet, FileText, Loader2, X } from "lucide-react";
import { useState } from "react";
import { QuoteExtractionJobsService } from "../../../modules/quote-extraction/services/quote-extraction-jobs.service";
import { useManualQuoteStore } from "../../../store/quote/manual-quote.store";
import type { ExtractedQuoteItem } from "../../../modules/quote-extraction/types/quote-extraction-job.types";
import { AttachmentsService } from "../../../modules/attachments/services/attachments.service";

type QuoteExtractionMode = "file" | "text";

interface QuoteExtractionModalProps {
  mode: QuoteExtractionMode;
  open: boolean;
  onClose: () => void;
  onCompleted: (source: QuoteExtractionMode) => void;
}

export const QuoteExtractionModal = ({ mode, open, onClose, onCompleted }: QuoteExtractionModalProps) => {
  const draftItemsCount = useManualQuoteStore((state) => state.draft.items.length);
  const clientDraftId = useManualQuoteStore((state) => state.draft.id);
  const setItemsFromExtraction = useManualQuoteStore((state) => state.setItemsFromExtraction);
  const addItemsFromExtraction = useManualQuoteStore((state) => state.addItemsFromExtraction);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [inputText, setInputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingItems, setPendingItems] = useState<ExtractedQuoteItem[] | null>(null);
  const [pendingAttachmentId, setPendingAttachmentId] = useState<string | null>(null);
  const isFile = mode === "file";

  if (!open) return null;

  const resetFeedback = () => {
    setErrorMessage(null);
    setProgress(0);
    setStatusText("");
  };

  const handleClose = (keepAttachment = false) => {
    if (processing) return;
    if (!keepAttachment && pendingAttachmentId) {
      void AttachmentsService.delete(pendingAttachmentId).catch(() => undefined);
    }
    resetFeedback();
    setPendingItems(null);
    setPendingAttachmentId(null);
    onClose();
  };

  const applyExtractedItems = (action: "append" | "replace") => {
    if (!pendingItems) return;

    if (action === "append") {
      addItemsFromExtraction(pendingItems);
    } else {
      setItemsFromExtraction(pendingItems);
    }

    setPendingItems(null);
    setPendingAttachmentId(null);
    setSelectedFile(null);
    setInputText("");
    onCompleted(mode);
  };

  const handleProcess = async () => {
    const cleanText = inputText.trim();
    if (processing || (isFile ? !selectedFile : !cleanText)) return;

    let uploadedAttachmentId: string | null = null;
    try {
      setProcessing(true);
      setErrorMessage(null);
      setProgress(5);
      setStatusText(isFile ? "Subiendo archivo..." : "Enviando texto...");

      if (isFile) {
        const attachment = await AttachmentsService.uploadQuoteSource(clientDraftId, selectedFile as File);
        uploadedAttachmentId = attachment.id;
      }
      const job = isFile
        ? await QuoteExtractionJobsService.createJob(selectedFile as File)
        : await QuoteExtractionJobsService.createTextJob({ text: cleanText });

      setProgress(10);
      setStatusText("Procesando extracción...");

      const result = await QuoteExtractionJobsService.waitForCompletion(job.job_id, {
        onStatus: (status) => {
          setProgress(Math.max(10, Math.min(100, status.progress || 0)));
          if (status.status === "queued") setStatusText("En cola de procesamiento...");
          if (status.status === "processing") setStatusText(isFile ? "Extrayendo partidas del archivo..." : "Extrayendo partidas del texto...");
          if (status.status === "completed") setStatusText("Extracción completada.");
        },
      });

      const extractedItems = result.result?.items ?? [];
      setProgress(100);
      if (draftItemsCount > 0) {
        setPendingAttachmentId(uploadedAttachmentId);
        setStatusText(`Se extrajeron ${extractedItems.length} partidas. Elige cómo incorporarlas.`);
        setPendingItems(extractedItems);
        return;
      }

      setItemsFromExtraction(extractedItems);
      setStatusText(`Listo. Se cargaron ${extractedItems.length} partidas.`);
      setSelectedFile(null);
      setInputText("");
      onCompleted(mode);
    } catch (error) {
      if (uploadedAttachmentId) {
        await AttachmentsService.delete(uploadedAttachmentId).catch(() => undefined);
      }
      setErrorMessage(error instanceof Error ? error.message : `No se pudo procesar ${isFile ? "el archivo" : "el texto"}.`);
      setStatusText("Error durante el procesamiento.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800">{isFile ? "Subir archivo" : "Pegar texto"}</h3>
            <p className="mt-1 text-sm text-gray-500">
              {isFile
                ? "Sube un PDF o Excel para que la IA extraiga las partidas."
                : "Pega el correo o mensaje de WhatsApp para que la IA identifique las partidas."}
            </p>
          </div>
          <button onClick={() => handleClose()} disabled={processing} className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {pendingItems ? (
          <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h4 className="text-sm font-semibold text-amber-900">¿Qué deseas hacer con las {pendingItems.length} partidas extraídas?</h4>
            <p className="mt-1 text-xs text-amber-800">Puedes conservar las partidas actuales y anexar las nuevas, o sustituir la lista actual.</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => applyExtractedItems("append")}
                className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Agregar más partidas
              </button>
              <button
                onClick={() => applyExtractedItems("replace")}
                className="rounded-md border border-amber-400 bg-white px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100"
              >
                Sustituir partidas
              </button>
            </div>
          </div>
        ) : isFile ? (
          <div className="mt-5 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
            <input
              type="file"
              accept=".pdf,.xlsx,.xls"
              disabled={processing}
              onChange={(event) => {
                setSelectedFile(event.currentTarget.files?.[0] ?? null);
                resetFeedback();
              }}
              className="w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-300"
            />
            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <FileText className="h-4 w-4" />
              <FileSpreadsheet className="h-4 w-4" />
              Tipos permitidos: PDF, XLSX, XLS
            </div>
            {selectedFile && <p className="mt-3 text-xs text-gray-600">Archivo seleccionado: <span className="font-semibold">{selectedFile.name}</span></p>}
          </div>
        ) : (
          <textarea
            value={inputText}
            disabled={processing}
            onChange={(event) => {
              setInputText(event.target.value);
              resetFeedback();
            }}
            rows={9}
            placeholder={'Ejemplo: Hola, necesito 20 válvulas check 2", 80 m de tubo 4" céd. 40, 12 codos 90°...'}
            className="mt-5 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
          />
        )}

        {!pendingItems && (processing || statusText) && (
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
            <p className="text-xs font-semibold text-blue-700">{statusText || "Procesando..."}</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
              <div className="h-full rounded bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-blue-700">{progress}%</p>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </div>
        )}

        {!pendingItems && <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => handleClose()} disabled={processing} className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60">
            Cancelar
          </button>
          <button
            onClick={() => void handleProcess()}
            disabled={processing || (isFile ? !selectedFile : !inputText.trim())}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-500 to-sky-600 px-3 py-2 text-xs font-semibold text-white hover:from-indigo-600 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? "Procesando..." : isFile ? "Procesar archivo" : "Procesar texto"}
          </button>
        </div>}
      </div>
    </div>
  );
};
