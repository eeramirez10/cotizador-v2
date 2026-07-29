import { Paperclip, X } from "lucide-react";
import { useState } from "react";
import type { FileAttachment } from "../../../modules/attachments/services/attachments.service";
import { AttachmentsPanel } from "./attachments-panel";
import { PdfAttachmentViewerModal } from "./pdf-attachment-viewer.modal";

export const AttachmentsModal = ({
  title = "Archivos adjuntos",
  files,
  loading = false,
  itemLabels,
  offerLabels,
  canDelete = false,
  busyFileId,
  onClose,
  onDownload,
  onDelete,
}: {
  title?: string;
  files: FileAttachment[];
  loading?: boolean;
  itemLabels?: Record<string, string>;
  offerLabels?: Record<string, string>;
  canDelete?: boolean | ((file: FileAttachment) => boolean);
  busyFileId?: string | null;
  onClose: () => void;
  onDownload: (file: FileAttachment) => void;
  onDelete?: (file: FileAttachment) => void;
}) => {
  const [previewFile, setPreviewFile] = useState<FileAttachment | null>(null);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="attachments-modal-title">
      <button type="button" className="absolute inset-0 bg-slate-950/60" onClick={onClose} aria-label="Cerrar archivos adjuntos" />
      <div className="relative flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-amber-100 p-2 text-amber-700"><Paperclip className="h-5 w-5" /></span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700">Expediente</p>
              <h2 id="attachments-modal-title" className="text-base font-semibold text-slate-900">{title}</h2>
              <p className="mt-1 text-xs text-slate-500">Consulta los documentos relacionados con esta cotización.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Cerrar"><X className="h-5 w-5" /></button>
        </header>

        <div className="overflow-y-auto bg-slate-50 p-4 sm:p-5">
          <AttachmentsPanel
            files={files}
            loading={loading}
            itemLabels={itemLabels}
            offerLabels={offerLabels}
            canDelete={canDelete}
            busyFileId={busyFileId}
            onPreview={setPreviewFile}
            onDownload={onDownload}
            onDelete={onDelete}
          />
        </div>
      </div>

      {previewFile && <PdfAttachmentViewerModal file={previewFile} onClose={() => setPreviewFile(null)} />}
    </div>
  );
};
