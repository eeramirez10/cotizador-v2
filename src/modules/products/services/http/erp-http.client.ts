import axios from "axios";
import { envs } from "../../../../config/envs";
import { preferApiErrorMessage } from "../../../../shared/utils/api-error-message";
import { getAuthToken } from "../../../../store/auth/auth.store";

export const erpHttpClient = axios.create({
  baseURL: envs.ERP_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

if (import.meta.env.MODE === "staging") {
  erpHttpClient.interceptors.request.use((config) => {
    const token = getAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}

erpHttpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(preferApiErrorMessage(error)),
);

