import axios from "axios";
import { envs } from "../../../../config/envs";

export const erpUsersHttpClient = axios.create({
  baseURL: envs.ERP_USERS_API_URL || undefined,
  headers: {
    "Content-Type": "application/json",
  },
});
