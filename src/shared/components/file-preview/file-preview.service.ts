import type { FilePreviewKind, FilePreviewResult, PreviewableFile } from "./file-preview.types";
import { SpreadsheetPreviewService } from "./spreadsheet-preview.service";
import { WordPreviewService } from "./word-preview.service";

const extensionOf = (name: string): string => {
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] || "";
};

const WORD_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};
const SPREADSHEET_MIMES = new Set([
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel.sheet.macroenabled.12",
  "application/vnd.ms-excel.sheet.binary.macroenabled.12",
  "text/csv",
]);

export class FilePreviewService {
  static family(file: PreviewableFile): "pdf" | "image" | "word" | "spreadsheet" | "generic" {
    const mimeType = file.mimeType.toLowerCase().split(";", 1)[0].trim();
    const extension = extensionOf(file.originalName);
    if (mimeType === "application/pdf" || extension === ".pdf") return "pdf";
    if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(extension)) return "image";
    if (mimeType === WORD_MIME || mimeType === "application/msword" || [".doc", ".docx"].includes(extension)) return "word";
    if (SPREADSHEET_MIMES.has(mimeType) || [".xls", ".xlsx", ".xlsm", ".xlsb", ".csv"].includes(extension)) return "spreadsheet";
    return "generic";
  }

  static kind(file: PreviewableFile): FilePreviewKind {
    const extension = extensionOf(file.originalName);
    const family = this.family(file);
    if (family === "pdf" || family === "image" || family === "spreadsheet") return family;
    if (family === "word" && extension === ".docx") return "word";
    return "unsupported";
  }

  static typeLabel(file: PreviewableFile): string {
    const extension = extensionOf(file.originalName).replace(".", "").toUpperCase();
    if (extension) return extension;
    const kind = this.kind(file);
    return kind === "spreadsheet" ? "HOJA DE CÁLCULO" : kind.toUpperCase();
  }

  static colors(file: PreviewableFile): { background: string; foreground: string } {
    const family = this.family(file);
    if (family === "spreadsheet") return { background: "#dcfce7", foreground: "#047857" };
    if (family === "word") return { background: "#dbeafe", foreground: "#1d4ed8" };
    if (family === "image") return { background: "#fef3c7", foreground: "#a16207" };
    if (family === "pdf") return { background: "#fee2e2", foreground: "#b91c1c" };
    return { background: "#e2e8f0", foreground: "#475569" };
  }

  static async create(file: PreviewableFile, blob: Blob): Promise<FilePreviewResult> {
    const kind = this.kind(file);
    if (kind === "pdf" || kind === "image") {
      const expectedMime = kind === "pdf"
        ? "application/pdf"
        : IMAGE_MIME_BY_EXTENSION[extensionOf(file.originalName)] || file.mimeType;
      const previewBlob = !blob.type || blob.type === "application/octet-stream"
        ? new Blob([blob], { type: expectedMime })
        : blob;
      return { kind, objectUrl: URL.createObjectURL(previewBlob) };
    }
    if (kind === "word") return WordPreviewService.convert(await blob.arrayBuffer());
    if (kind === "spreadsheet") {
      const extension = extensionOf(file.originalName);
      return SpreadsheetPreviewService.convert(
        await blob.arrayBuffer(),
        extension === ".xlsm" || extension === ".xlsb" || file.mimeType.toLowerCase().includes("macroenabled"),
      );
    }
    const extension = extensionOf(file.originalName);
    return {
      kind: "unsupported",
      reason: extension === ".doc"
        ? "Los documentos Word .doc no admiten vista previa. Descarga el archivo para abrirlo."
        : "La vista previa no está disponible para este formato. Puedes descargar el archivo original.",
    };
  }

  static revoke(result: FilePreviewResult | null): void {
    if (result?.kind === "pdf" || result?.kind === "image") URL.revokeObjectURL(result.objectUrl);
  }
}
