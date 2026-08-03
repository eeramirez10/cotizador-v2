import axios from "axios";
import { aiHttpClient } from "../../ai/services/http/ai-http.client";

export interface ExtractedSupplierQuoteItem {
  lineNumber: string | null;
  supplierProductCode: string | null;
  alternateCodes: string[];
  description: string;
  quantity: number | null;
  unit: string | null;
  listUnitPrice: number | null;
  discountPct: number | null;
  netUnitPrice: number | null;
  subtotal: number | null;
  brand: string | null;
  origin: string | null;
  deliveryTime: string | null;
  availableDate: string | null;
  minimumQuantity: number | null;
  confidence: number;
  requiresReview: boolean;
  evidence: string | null;
}

export interface ExtractedSupplierData {
  name: string | null;
  taxId: string | null;
  state: string | null;
  country: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  contacts: ExtractedSupplierContact[];
  confidence: number;
  evidence: string | null;
}

export interface ExtractedSupplierContact {
  channel: "EMAIL" | "PHONE";
  value: string;
  phoneKind: "LANDLINE" | "MOBILE" | "UNKNOWN" | null;
  extension: string | null;
  isWhatsApp: boolean;
  contactName: string | null;
  contactPosition: string | null;
  label: string | null;
  confidence: number;
  evidence: string | null;
}

export interface SupplierQuoteExtractionResult {
  fileName: string;
  supplier: ExtractedSupplierData;
  header: { reference: string | null; quoteDate: string | null; validUntil: string | null; currency: "MXN" | "USD" | null; exchangeRate: number | null; paymentTerms: string | null; deliveryTerms: string | null };
  totals: { subtotal: number | null; discount: number | null; freight: number | null; otherCharges: number | null; taxIncluded: boolean | null; taxRate: number | null; tax: number | null; total: number | null };
  items: ExtractedSupplierQuoteItem[];
  warnings: string[];
  requiresReview: boolean;
}

interface JobCreated { job_id: string }
interface JobStatus { status: "queued" | "processing" | "completed" | "failed"; progress: number; error: string | null }
interface JobResult { status: string; result?: SupplierQuoteExtractionResult; error?: string | null }

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

export class SupplierQuoteExtractionService {
  static async extract(file: File, onProgress?: (progress: number) => void): Promise<SupplierQuoteExtractionResult> {
    const form = new FormData();
    form.append("file", file);
    try {
      const created = await aiHttpClient.post<JobCreated>("/api/extract/jobs/supplier-quote", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const startedAt = Date.now();
      while (Date.now() - startedAt < 4 * 60_000) {
        const status = (await aiHttpClient.get<JobStatus>(`/api/extract/jobs/${created.data.job_id}/status`)).data;
        onProgress?.(status.progress);
        if (status.status === "failed") throw new Error(status.error || "La IA no pudo procesar la cotización.");
        if (status.status === "completed") {
          const response = (await aiHttpClient.get<JobResult>(`/api/extract/jobs/${created.data.job_id}/result`)).data;
          if (!response.result) throw new Error(response.error || "La IA no devolvió información utilizable.");
          return response.result;
        }
        await sleep(2_000);
      }
      throw new Error("La extracción excedió el tiempo de espera.");
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error;
        if (typeof message === "string") throw new Error(message);
      }
      throw error;
    }
  }
}
