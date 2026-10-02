import axios from "axios";
import { envs } from "../../../../config/envs";
import { preferApiErrorMessage } from "../../../../shared/utils/api-error-message";

export const erpHttpClient = axios.create({
  baseURL: envs.ERP_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

erpHttpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(preferApiErrorMessage(error)),
);

