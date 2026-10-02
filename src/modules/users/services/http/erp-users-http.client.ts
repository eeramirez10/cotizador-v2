import axios from "axios";
import { envs } from "../../../../config/envs";
import { preferApiErrorMessage } from "../../../../shared/utils/api-error-message";

export const erpUsersHttpClient = axios.create({
  baseURL: envs.ERP_USERS_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});

erpUsersHttpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => Promise.reject(preferApiErrorMessage(error)),
);
