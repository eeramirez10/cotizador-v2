import axios from "axios";
import { aiHttpClient } from "../../ai/services/http/ai-http.client";

export interface TechnicalAttributeSuggestion {
  key: string;
  label: string;
  value: string;
  confidence: number;
  evidence: string;
}

export interface TechnicalDataSuggestion {
  family: string;
  familyLabel: string;
  confidence: number;
  attributes: TechnicalAttributeSuggestion[];
}

export interface TechnicalDataBatchInput {
  itemId: string;
  requestedDescription: string;
  supplierDescription?: string;
  existingAttributes?: Record<string, string>;
}

export interface TechnicalDataBatchSuggestion extends TechnicalDataSuggestion {
  itemId: string;
}

export class TechnicalDataService {
  static async suggest(input: {
    requestedDescription: string;
    supplierDescription?: string;
    existingAttributes?: Record<string, string>;
  }): Promise<TechnicalDataSuggestion> {
    try {
      const { data } = await aiHttpClient.post<TechnicalDataSuggestion>(
        "/api/procurement/technical-data/suggest",
        input,
      );
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
        throw new Error(error.response.data.error);
      }
      throw new Error("No se pudieron sugerir los datos técnicos.");
    }
  }

  static async suggestBatch(items: TechnicalDataBatchInput[]): Promise<TechnicalDataBatchSuggestion[]> {
    try {
      const { data } = await aiHttpClient.post<{ items: TechnicalDataBatchSuggestion[] }>(
        "/api/procurement/technical-data/suggest-batch",
        { items },
      );
      return Array.isArray(data.items) ? data.items : [];
    } catch (error) {
      if (axios.isAxiosError(error) && typeof error.response?.data?.error === "string") {
        throw new Error(error.response.data.error);
      }
      throw new Error("No se pudieron sugerir los datos técnicos por lote.");
    }
  }
}
