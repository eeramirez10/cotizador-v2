import { FileSpreadsheet, FileText, FileUp, SquarePen } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";

export const NewQuotePage = () => {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const acceptedTypes = ".pdf,.xlsx,.xls";

  const handleManualQuote = () => {
    navigate("/quotes/manual");
  };

  const handleUploadClick = () => {
    navigate("/cotizador?mode=file");
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
            onClick={handleUploadClick}
            disabled={!selectedFile}
            className="rounded-md bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-semibold text-white hover:from-emerald-600 hover:to-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Procesar archivo
          </button>

          {selectedFile && (
            <p className="mt-3 text-xs text-gray-500">
              Archivo seleccionado: <span className="font-semibold text-gray-700">{selectedFile.name}</span>
            </p>
          )}
        </article>
      </div>
    </section>
  );
};
