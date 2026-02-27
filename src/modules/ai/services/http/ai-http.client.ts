import axios from "axios";
import { envs } from "../../../../config/envs";

export const aiHttpClient = axios.create({
  baseURL: envs.AI_API_URL || undefined,
});
