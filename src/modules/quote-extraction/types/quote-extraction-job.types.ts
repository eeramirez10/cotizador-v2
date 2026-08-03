export type ExtractionJobStatus = "queued" | "processing" | "completed" | "failed";

export interface ExtractedQuoteItem {
  description_original: string;
  description_normalizada: string;
  cantidad: number | null;
  unidad_original: string | null;
  unidad_normalizada: string | null;
  idioma: string;
  requiere_revision: boolean;
}

export interface ExtractedQuotedExcelItem {
  description_original: string;
  description_normalizada: string;
  cantidad: number | null;
  unidad: string | null;
  precio_vendedor: number | null;
  subtotal: number | null;
  moneda: "MXN" | "USD" | null;
  tiempo_entrega: string | null;
  requiere_revision: boolean;
}

export interface ExtractionJobCreateResponse {
  job_id: string;
  status: ExtractionJobStatus;
  created_at: string;
}

export interface ExtractionJobStatusResponse {
  job_id: string;
  status: ExtractionJobStatus;
  progress: number;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ExtractionJobResultPayload {
  file_name: string;
  file_type: string;
  items_count: number;
  items: ExtractedQuoteItem[];
}

export interface ExtractionJobResultResponse {
  job_id: string;
  status: ExtractionJobStatus;
  result?: ExtractionJobResultPayload;
  error?: string | null;
  message?: string;
}

export interface QuotedExcelExtractionJobResultResponse {
  job_id: string;
  status: ExtractionJobStatus;
  result?: {
    file_name: string;
    file_type: string;
    items_count: number;
    items: ExtractedQuotedExcelItem[];
  };
  error?: string | null;
  message?: string;
}
