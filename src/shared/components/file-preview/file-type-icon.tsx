import { File, FileImage, FileSpreadsheet, FileText } from "lucide-react";
import { FilePreviewService } from "./file-preview.service";
import type { PreviewableFile } from "./file-preview.types";

export const FileTypeIcon = ({ file, size = 20 }: { file: PreviewableFile; size?: number }) => {
  const family = FilePreviewService.family(file);
  if (family === "spreadsheet") return <FileSpreadsheet size={size} />;
  if (family === "image") return <FileImage size={size} />;
  if (family === "word" || family === "pdf") return <FileText size={size} />;
  return <File size={size} />;
};
