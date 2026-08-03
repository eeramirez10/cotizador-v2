import axios from "axios";
import { aiHttpClient } from "./http/ai-http.client";
import type { ExtractedPartyData, PartyDataType } from "../types/party-data.types";

export class PartyDataExtractionService {
  static async extract(text: string, partyType: PartyDataType): Promise<ExtractedPartyData> {
    try {
      const { data } = await aiHttpClient.post<ExtractedPartyData>("/api/parties/extract", {
        text: text.trim(),
        partyType,
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.error;
        if (typeof message === "string") throw new Error(message);
      }
      throw error;
    }
  }
}
