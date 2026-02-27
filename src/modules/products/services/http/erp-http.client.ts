import axios from "axios";
import { envs } from "../../../../config/envs";

export const erpHttpClient = axios.create({
  baseURL: envs.ERP_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});


