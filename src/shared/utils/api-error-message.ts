import { isAxiosError } from "axios";

export const preferApiErrorMessage = (error: unknown): unknown => {
  if (!isAxiosError(error)) return error;

  const data: unknown = error.response?.data;
  if (!data || typeof data !== "object" || Array.isArray(data)) return error;

  const payload = data as Record<string, unknown>;
  const value = typeof payload.error === "string" ? payload.error : payload.message;
  if (typeof value === "string" && value.trim()) error.message = value.trim();

  return error;
};
