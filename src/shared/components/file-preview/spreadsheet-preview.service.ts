import type { FilePreviewResult, SpreadsheetPreviewSheet } from "./file-preview.types";

const MAX_ROWS = 200;
const MAX_COLUMNS = 50;

const cellText = (value: unknown): string => value == null ? "" : String(value);

export class SpreadsheetPreviewService {
  static async convert(
    arrayBuffer: ArrayBuffer,
    macroEnabled: boolean,
  ): Promise<Extract<FilePreviewResult, { kind: "spreadsheet" }>> {
    const XLSX = await import("xlsx");
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheets: SpreadsheetPreviewSheet[] = workbook.SheetNames.map((name) => {
      const worksheet = workbook.Sheets[name];
      const sourceRows = worksheet
        ? XLSX.utils.sheet_to_json<unknown[]>(worksheet, { header: 1, raw: false, defval: "" })
        : [];
      const totalColumns = sourceRows.reduce((maximum, row) => Math.max(maximum, row.length), 0);
      return {
        name,
        rows: sourceRows.slice(0, MAX_ROWS).map((row) => row.slice(0, MAX_COLUMNS).map(cellText)),
        totalRows: sourceRows.length,
        totalColumns,
        truncated: sourceRows.length > MAX_ROWS || totalColumns > MAX_COLUMNS,
      };
    });
    return { kind: "spreadsheet", sheets, macroEnabled };
  }
}
