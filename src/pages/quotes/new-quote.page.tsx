import { AlertCircle, FileSpreadsheet, FileText, FileUp, Loader2, SquarePen } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { QuoteExtractionJobsService } from "../../modules/quote-extraction/services/quote-extraction-jobs.service";
import { useAuthStore } from "../../store/auth/auth.store";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";

export const NewQuotePage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearDraft = useManualQuoteStore((state) => state.clearDraft);
  const initializeDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setItemsFromExtraction = useManualQuoteStore((state) => state.setItemsFromExtraction);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [jobStatusText, setJobStatusText] = useState<string>("");
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const acceptedTypes = ".pdf,.xlsx,.xls";

  const handleManualQuote = () => {
    navigate("/quotes/manual");
  };

  const handleUploadClick = async () => {
    if (!selectedFile || processing) return;

    try {
      setProcessing(true);
      setErrorMessage(null);
      setJobProgress(5);
      setJobStatusText("Subiendo archivo...");

      const job = await QuoteExtractionJobsService.createJob(selectedFile);

      setJobStatusText("Procesando extracción...");
      setJobProgress(10);

      const result = await QuoteExtractionJobsService.waitForCompletion(job.job_id, {
        onStatus: (status) => {
          setJobProgress(Math.max(10, Math.min(100, status.progress || 0)));

          if (status.status === "queued") setJobStatusText("En cola de procesamiento...");
          if (status.status === "processing") setJobStatusText("Extrayendo partidas del archivo...");
          if (status.status === "completed") setJobStatusText("Extracción completada.");
        },
      });

      const extractedItems = result.result?.items ?? [];

      clearDraft();
      initializeDraft(user);
      setItemsFromExtraction(extractedItems);

      setJobProgress(100);
      setJobStatusText(`Listo. Se cargaron ${extractedItems.length} partidas.`);

      navigate("/quotes/manual?source=file");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar el archivo.";
      setErrorMessage(message);
      setJobStatusText("Error durante el procesamiento.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800">Cotizador</h2>
      <p className="mt-1 text-sm text-gray-500">
        Selecciona el modo de trabajo: carga archivo para extracción o crea la cotización manualmente.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-gray-800">
            <SquarePen className="h-5 w-5" />
            <h3 className="text-base font-semibold">Generar manualmente</h3>
          </div>

          <p className="mb-4 text-sm text-gray-600">Crea la cotización desde cero y captura las partidas manualmente.</p>

          <button
            onClick={handleManualQuote}
            className="rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            Crear cotización manual
          </button>
        </article>

        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-gray-800">
            <FileUp className="h-5 w-5" />
            <h3 className="text-base font-semibold">Subir archivo</h3>
          </div>

          <p className="mb-3 text-sm text-gray-600">Sube un PDF o Excel para extraer partidas automáticamente.</p>

          <div className="mb-4 rounded-md border border-dashed border-gray-300 bg-gray-50 p-4">
            <input
              type="file"
              accept={acceptedTypes}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0] ?? null;
                setSelectedFile(file);
                setErrorMessage(null);
                setJobProgress(0);
                setJobStatusText("");
              }}
              className="w-full text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-300"
            />

            <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
              <FileText className="h-4 w-4" />
              <FileSpreadsheet className="h-4 w-4" />
              Tipos permitidos: PDF, XLSX, XLS
            </div>
          </div>

          <button
            onClick={() => {
              void handleUploadClick();
            }}
            disabled={!selectedFile || processing}
            className="inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {processing && <Loader2 className="h-4 w-4 animate-spin" />}
            {processing ? "Procesando..." : "Procesar archivo"}
          </button>

          {selectedFile && (
            <p className="mt-3 text-xs text-gray-500">
              Archivo seleccionado: <span className="font-semibold text-gray-700">{selectedFile.name}</span>
            </p>
          )}

          {(processing || jobStatusText) && (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">{jobStatusText || "Procesando..."}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
                <div className="h-full rounded bg-blue-600 transition-all duration-300" style={{ width: `${jobProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-blue-700">{jobProgress}%</p>
            </div>
          )}

          {errorMessage && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {errorMessage}
            </div>
          )}
        </article>
      </div>
    </section>
  );
};
