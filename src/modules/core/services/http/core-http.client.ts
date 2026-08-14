import axios from "axios";
import { envs } from "../../../../config/envs";

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | undefined;

const isLoginRequest = (url?: string): boolean =>
  Boolean(url && /\/api\/auth\/login(?:\?|$)/.test(url));

export const configureCoreUnauthorizedHandler = (handler: UnauthorizedHandler): void => {
  unauthorizedHandler = handler;
};

export const coreHttpClient = axios.create({
  baseURL: envs.CORE_API_URL || undefined,
});

coreHttpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !isLoginRequest(error.config?.url)
    ) {
      unauthorizedHandler?.();
    }

    return Promise.reject(error);
  },
);
