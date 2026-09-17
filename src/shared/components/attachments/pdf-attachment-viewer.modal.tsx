import { AttachmentsService, type FileAttachment } from "../../../modules/attachments/services/attachments.service";
import { FilePreviewModal } from "../file-preview/file-preview.modal";
import type { PreviewableFile } from "../file-preview/file-preview.types";

export type PreviewableAttachment = PreviewableFile;

export const PdfAttachmentViewerModal = ({ file, onClose, getBlob, downloadFile }: {
  file: PreviewableAttachment;
  onClose: () => void;
  getBlob?: (file: PreviewableAttachment) => Promise<Blob>;
  downloadFile?: (file: PreviewableAttachment) => Promise<void>;
}) => (
  <FilePreviewModal
    file={file}
    onClose={onClose}
    getBlob={getBlob || ((selected) => AttachmentsService.getBlob(selected as FileAttachment))}
    downloadFile={downloadFile || ((selected) => AttachmentsService.download(selected as FileAttachment))}
  />
);
