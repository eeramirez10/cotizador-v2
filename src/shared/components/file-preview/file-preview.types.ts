export interface PreviewableFile {
  id: string;
  originalName: string;
  mimeType: string;
}

export type FilePreviewKind = "pdf" | "image" | "word" | "spreadsheet" | "unsupported";

export interface SpreadsheetPreviewSheet {
  name: string;
  rows: string[][];
  totalRows: number;
  totalColumns: number;
  truncated: boolean;
}

export type FilePreviewResult =
  | { kind: "pdf"; objectUrl: string }
  | { kind: "image"; objectUrl: string }
  | { kind: "word"; html: string; warnings: string[] }
  | { kind: "spreadsheet"; sheets: SpreadsheetPreviewSheet[]; macroEnabled: boolean }
  | { kind: "unsupported"; reason: string };

export interface UseFilePreviewOptions {
  file: PreviewableFile | null;
  getBlob: (file: PreviewableFile) => Promise<Blob>;
}
