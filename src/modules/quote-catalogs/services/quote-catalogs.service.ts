import axios from "axios";
import { getAuthToken } from "../../../store/auth/auth.store";
import { coreHttpClient } from "../../core/services/http/core-http.client";
import { aiHttpClient } from "../../ai/services/http/ai-http.client";

export type QuoteCatalogType = "VALIDITY_DAYS" | "PAYMENT_TERMS" | "COMMERCIAL_CONDITIONS" | "DELIVERY_TIME" | "REVISION_REASON" | "REJECTION_REASON" | "CANCELLATION_REASON" | "APPROVAL_RETURN_REASON" | "PURCHASE_BRAND" | "ORIGIN_RESTRICTION" | "DELIVERY_STATE";
export interface QuoteCatalogOption { id: string; type: QuoteCatalogType; code: string; label: string; value: string | null; numericValue: number | null; requiresComment: boolean; sortOrder: number; isActive: boolean; branchId: string | null; scope: "GLOBAL" | "BRANCH"; }
export interface UpsertQuoteCatalogOptionInput { type: QuoteCatalogType; code?: string; label: string; value?: string | null; numericValue?: number | null; requiresComment?: boolean; sortOrder?: number; branchId?: string | null; isActive?: boolean; }
export interface SuggestQuoteCatalogCodeInput { type: QuoteCatalogType; label: string; existingCodes: string[]; }
const headers = () => { const token = getAuthToken(); if (!token) throw new Error("Sesión no válida. Inicia sesión nuevamente."); return { Authorization: `Bearer ${token}` }; };
const mapError = (error: unknown, fallback: string): Error => axios.isAxiosError(error) && typeof error.response?.data?.error === "string" ? new Error(error.response.data.error) : new Error(fallback);

export class QuoteCatalogsService {
  static async list(type?: QuoteCatalogType): Promise<QuoteCatalogOption[]> { try { const { data } = await coreHttpClient.get<QuoteCatalogOption[]>("/api/quote-catalogs", { headers: headers(), params: type ? { type } : undefined }); return data || []; } catch (error) { throw mapError(error, "No se pudieron cargar las opciones."); } }
  static async listManaged(): Promise<QuoteCatalogOption[]> { try { const { data } = await coreHttpClient.get<QuoteCatalogOption[]>("/api/quote-catalogs/manage", { headers: headers() }); return data || []; } catch (error) { throw mapError(error, "No se pudieron cargar los catálogos."); } }
  static async create(input: UpsertQuoteCatalogOptionInput): Promise<QuoteCatalogOption> { try { const { data } = await coreHttpClient.post<QuoteCatalogOption>("/api/quote-catalogs", input, { headers: headers() }); return data; } catch (error) { throw mapError(error, "No se pudo crear la opción."); } }
  static async update(id: string, input: UpsertQuoteCatalogOptionInput): Promise<QuoteCatalogOption> { try { const { data } = await coreHttpClient.patch<QuoteCatalogOption>(`/api/quote-catalogs/${encodeURIComponent(id)}`, input, { headers: headers() }); return data; } catch (error) { throw mapError(error, "No se pudo actualizar la opción."); } }
  static async deactivate(id: string): Promise<void> { try { await coreHttpClient.patch(`/api/quote-catalogs/${encodeURIComponent(id)}/deactivate`, {}, { headers: headers() }); } catch (error) { throw mapError(error, "No se pudo desactivar la opción."); } }
  static async suggestCode(input: SuggestQuoteCatalogCodeInput): Promise<string> { try { const { data } = await aiHttpClient.post<{ code: string }>("/api/quote-catalogs/suggest-code", input); if (!data?.code) throw new Error("La IA no devolvió un código interno."); return data.code; } catch (error) { if (error instanceof Error && !axios.isAxiosError(error)) throw error; throw mapError(error, "No se pudo generar el código interno con IA."); } }
}
