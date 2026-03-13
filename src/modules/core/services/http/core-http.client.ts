import axios from "axios";
import { envs } from "../../../../config/envs";

export const coreHttpClient = axios.create({
  baseURL: envs.CORE_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});
