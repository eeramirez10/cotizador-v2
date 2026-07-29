import { Download, Eye, FileSpreadsheet, FileText, Image, Loader2, Paperclip, Trash2 } from "lucide-react";
import type { FileAttachment } from "../../../modules/attachments/services/attachments.service";

const labels: Record<FileAttachment["category"], string> = {
  SOURCE_DOCUMENT: "Archivo origen",
  SELLER_SUPPLIER_QUOTE: "Cotización del proveedor (vendedor)",
  PURCHASE_SUPPLIER_PROPOSAL: "Propuesta registrada por Compras",
};

const size = (bytes: number) => bytes < 1024 * 1024
  ? `${Math.max(1, Math.round(bytes / 1024))} KB`
  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const Icon = ({ mime }: { mime: string }) => {
  if (mime.startsWith("image/")) return <Image className="h-4 w-4" />;
  if (mime.includes("excel") || mime.includes("spreadsheet")) return <FileSpreadsheet className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
};

export const AttachmentsPanel = ({
  files,
  loading = false,
  title = "Archivos adjuntos",
  itemLabels,
  offerLabels,
  canDelete = false,
  busyFileId,
  onPreview,
  onDownload,
  onDelete,
}: {
  files: FileAttachment[];
  loading?: boolean;
  title?: string;
  itemLabels?: Record<string, string>;
  offerLabels?: Record<string, string>;
  canDelete?: boolean | ((file: FileAttachment) => boolean);
  busyFileId?: string | null;
  onPreview?: (file: FileAttachment) => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
}) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Paperclip className="h-4 w-4 text-amber-600" />
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">{files.length}</span>
    </div>
    {loading && <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500"><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando archivos...</p>}
    {!loading && files.length === 0 && <p className="mt-3 text-xs text-slate-500">No hay archivos adjuntos.</p>}
    <div className="mt-3 space-y-2">
      {files.map((file) => (
        <article key={file.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-slate-700"><Icon mime={file.mimeType} /><p className="truncate text-xs font-semibold">{file.originalName}</p></div>
            <p className="mt-1 text-[10px] text-slate-500">{labels[file.category]} · {size(file.sizeBytes)} · {file.uploadedByName}</p>
            {file.clientItemIds.length > 0 && <p className="mt-1 text-[10px] text-amber-700">Partidas: {file.clientItemIds.map((id) => itemLabels?.[id] || id).join(", ")}</p>}
            {file.purchaseOfferIds.length > 0 && <p className="mt-1 text-[10px] text-blue-700">Propuestas: {file.purchaseOfferIds.map((id) => offerLabels?.[id] || id).join(", ")}</p>}
          </div>
          <div className="flex shrink-0 gap-1">
            {file.mimeType === "application/pdf" && onPreview && <button type="button" onClick={() => onPreview(file)} disabled={busyFileId === file.id} className="rounded-md border border-amber-300 bg-amber-50 p-1.5 text-amber-800 hover:bg-amber-100 disabled:opacity-50" title="Ver PDF"><Eye className="h-3.5 w-3.5" /></button>}
            <button type="button" onClick={() => onDownload(file)} disabled={busyFileId === file.id} className="rounded-md border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-50" title="Descargar"><Download className="h-3.5 w-3.5" /></button>
            {(typeof canDelete === "function" ? canDelete(file) : canDelete) && onDelete && <button type="button" onClick={() => onDelete(file)} disabled={busyFileId === file.id} className="rounded-md border border-rose-200 bg-white p-1.5 text-rose-600 hover:bg-rose-50 disabled:opacity-50" title="Eliminar"><Trash2 className="h-3.5 w-3.5" /></button>}
          </div>
        </article>
      ))}
    </div>
  </section>
);
