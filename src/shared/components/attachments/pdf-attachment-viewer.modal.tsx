import { Download, FileText, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { AttachmentsService, type FileAttachment } from "../../../modules/attachments/services/attachments.service";
import { notifier } from "../../notifications/notifier";

export const PdfAttachmentViewerModal = ({ file, onClose }: {
  file: FileAttachment;
  onClose: () => void;
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let active = true;
    let url: string | null = null;

    const load = async () => {
      try {
        const blob = await AttachmentsService.getBlob(file);
        if (!active) return;
        url = URL.createObjectURL(blob);
        setObjectUrl(url);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "No se pudo abrir el PDF.");
      }
    };

    void load();
    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const download = async () => {
    setDownloading(true);
    try {
      await AttachmentsService.download(file);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo descargar el PDF.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[180] flex items-center justify-center bg-slate-950/75 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="pdf-viewer-title">
      <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-2xl">
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="rounded-lg bg-amber-100 p-2 text-amber-700"><FileText className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Vista previa PDF</p>
              <h2 id="pdf-viewer-title" className="truncate text-sm font-semibold text-slate-900">{file.originalName}</h2>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button type="button" onClick={() => void download()} disabled={downloading} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Descargar
            </button>
            <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar visor"><X className="h-5 w-5" /></button>
          </div>
        </header>

        <div className="min-h-0 flex-1 bg-slate-200 p-2 sm:p-3">
          {!objectUrl && !error && <div className="flex h-full items-center justify-center gap-2 text-sm font-medium text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Cargando PDF...</div>}
          {error && <div className="flex h-full items-center justify-center"><div className="max-w-md rounded-xl border border-rose-200 bg-white p-5 text-center"><p className="text-sm font-semibold text-rose-700">{error}</p><button type="button" onClick={() => void download()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white">Descargar archivo</button></div></div>}
          {objectUrl && <iframe src={objectUrl} title={`Vista previa de ${file.originalName}`} className="h-full w-full rounded-lg border-0 bg-white" />}
        </div>
      </div>
    </div>
  );
};
