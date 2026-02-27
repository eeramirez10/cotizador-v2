import { AlertCircle, FileSpreadsheet, FileText, FileUp, Loader2, MessageSquareText, SquarePen } from "lucide-react";
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
  const [fileProcessing, setFileProcessing] = useState(false);
  const [fileJobStatusText, setFileJobStatusText] = useState<string>("");
  const [fileJobProgress, setFileJobProgress] = useState<number>(0);
  const [fileErrorMessage, setFileErrorMessage] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [textSource, setTextSource] = useState<"email" | "whatsapp" | "manual">("manual");
  const [textProcessing, setTextProcessing] = useState(false);
  const [textJobStatusText, setTextJobStatusText] = useState<string>("");
  const [textJobProgress, setTextJobProgress] = useState<number>(0);
  const [textErrorMessage, setTextErrorMessage] = useState<string | null>(null);

  const acceptedTypes = ".pdf,.xlsx,.xls";
  const processing = fileProcessing || textProcessing;

  const handleManualQuote = () => {
    navigate("/quotes/manual");
  };

  const handleUploadClick = async () => {
    if (!selectedFile || processing) return;

    try {
      setFileProcessing(true);
      setFileErrorMessage(null);
      setFileJobProgress(5);
      setFileJobStatusText("Subiendo archivo...");

      const job = await QuoteExtractionJobsService.createJob(selectedFile);

      setFileJobStatusText("Procesando extracción...");
      setFileJobProgress(10);

      const result = await QuoteExtractionJobsService.waitForCompletion(job.job_id, {
        onStatus: (status) => {
          setFileJobProgress(Math.max(10, Math.min(100, status.progress || 0)));

          if (status.status === "queued") setFileJobStatusText("En cola de procesamiento...");
          if (status.status === "processing") setFileJobStatusText("Extrayendo partidas del archivo...");
          if (status.status === "completed") setFileJobStatusText("Extracción completada.");
        },
      });

      const extractedItems = result.result?.items ?? [];

      clearDraft();
      initializeDraft(user);
      setItemsFromExtraction(extractedItems);

      setFileJobProgress(100);
      setFileJobStatusText(`Listo. Se cargaron ${extractedItems.length} partidas.`);

      navigate("/quotes/manual?source=file");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar el archivo.";
      setFileErrorMessage(message);
      setFileJobStatusText("Error durante el procesamiento.");
    } finally {
      setFileProcessing(false);
    }
  };

  const handleTextExtractionClick = async () => {
    const cleanText = inputText.trim();
    if (!cleanText || processing) return;

    try {
      setTextProcessing(true);
      setTextErrorMessage(null);
      setTextJobProgress(5);
      setTextJobStatusText("Enviando texto...");

      const job = await QuoteExtractionJobsService.createTextJob({
        text: cleanText,
        source: textSource,
      });

      setTextJobStatusText("Procesando extracción...");
      setTextJobProgress(10);

      const result = await QuoteExtractionJobsService.waitForCompletion(job.job_id, {
        onStatus: (status) => {
          setTextJobProgress(Math.max(10, Math.min(100, status.progress || 0)));

          if (status.status === "queued") setTextJobStatusText("En cola de procesamiento...");
          if (status.status === "processing") setTextJobStatusText("Extrayendo partidas del texto...");
          if (status.status === "completed") setTextJobStatusText("Extracción completada.");
        },
      });

      const extractedItems = result.result?.items ?? [];

      clearDraft();
      initializeDraft(user);
      setItemsFromExtraction(extractedItems);

      setTextJobProgress(100);
      setTextJobStatusText(`Listo. Se cargaron ${extractedItems.length} partidas.`);
      setInputText("");
      navigate("/quotes/manual?source=text");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo procesar el texto.";
      setTextErrorMessage(message);
      setTextJobStatusText("Error durante el procesamiento.");
    } finally {
      setTextProcessing(false);
    }
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-gray-800">Cotizador</h2>
      <p className="mt-1 text-sm text-gray-500">
        Selecciona el modo de trabajo: manual, subida de archivo o texto libre (correo/whatsapp).
      </p>

      <div className="mt-6 grid gap-5 xl:grid-cols-3">
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
                setFileErrorMessage(null);
                setFileJobProgress(0);
                setFileJobStatusText("");
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
            {fileProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {fileProcessing ? "Procesando..." : "Procesar archivo"}
          </button>

          {selectedFile && (
            <p className="mt-3 text-xs text-gray-500">
              Archivo seleccionado: <span className="font-semibold text-gray-700">{selectedFile.name}</span>
            </p>
          )}

          {(fileProcessing || fileJobStatusText) && (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">{fileJobStatusText || "Procesando..."}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
                <div className="h-full rounded bg-blue-600 transition-all duration-300" style={{ width: `${fileJobProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-blue-700">{fileJobProgress}%</p>
            </div>
          )}

          {fileErrorMessage && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {fileErrorMessage}
            </div>
          )}
        </article>

        <article className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2 text-gray-800">
            <MessageSquareText className="h-5 w-5" />
            <h3 className="text-base font-semibold">Pegar texto</h3>
          </div>

          <p className="mb-3 text-sm text-gray-600">
            Pega el requerimiento del cliente (correo o WhatsApp) para extraer partidas automáticamente.
          </p>

          <div className="mb-3">
            <label htmlFor="text-source" className="text-xs font-semibold uppercase text-gray-500">
              Origen
            </label>
            <select
              id="text-source"
              value={textSource}
              onChange={(event) => setTextSource(event.target.value as "email" | "whatsapp" | "manual")}
              className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-700"
            >
              <option value="manual">Manual</option>
              <option value="email">Email</option>
              <option value="whatsapp">WhatsApp</option>
            </select>
          </div>

          <textarea
            value={inputText}
            onChange={(event) => {
              setInputText(event.target.value);
              setTextErrorMessage(null);
              setTextJobProgress(0);
              setTextJobStatusText("");
            }}
            rows={8}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={'Ejemplo: Hola, necesito 20 válvulas check 2", 80 m de tubo 4" céd. 40, 12 codos 90°...'}
          />

          <button
            onClick={() => {
              void handleTextExtractionClick();
            }}
            disabled={inputText.trim().length === 0 || processing}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-gradient-to-r from-indigo-500 to-sky-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-600 hover:to-sky-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {textProcessing && <Loader2 className="h-4 w-4 animate-spin" />}
            {textProcessing ? "Procesando..." : "Procesar texto"}
          </button>

          {(textProcessing || textJobStatusText) && (
            <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-3">
              <p className="text-xs font-semibold text-blue-700">{textJobStatusText || "Procesando..."}</p>
              <div className="mt-2 h-2 w-full overflow-hidden rounded bg-blue-100">
                <div className="h-full rounded bg-blue-600 transition-all duration-300" style={{ width: `${textJobProgress}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-blue-700">{textJobProgress}%</p>
            </div>
          )}

          {textErrorMessage && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4" />
              {textErrorMessage}
            </div>
          )}
        </article>
      </div>
    </section>
  );
};
