import axios from "axios";
import { envs } from "../../../../config/envs";
import { getAuthToken } from "../../../../store/auth/auth.store";

export const aiHttpClient = axios.create({
  baseURL: envs.AI_API_URL || undefined,
});

const usesAuthenticatedCoreProxy = (() => {
  try {
    return new URL(envs.AI_API_URL).origin === new URL(envs.CORE_API_URL).origin;
  } catch {
    return false;
  }
})();

aiHttpClient.interceptors.request.use((config) => {
  if (!usesAuthenticatedCoreProxy) return config;
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
