import { loadEnv } from "vite";

const env = loadEnv("staging", process.cwd(), "VITE_");
for (const [key, expectedPath] of [
  ["VITE_CORE_API_URL", "/cotizador-staging"],
  ["VITE_AI_API_URL", "/ia-staging"],
]) {
  const value = env[key];
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be a valid absolute URL in .env.staging`);
  }
  if (url.protocol !== "https:" || url.pathname.replace(/\/$/, "") !== expectedPath) {
    throw new Error(`${key} must use HTTPS and the ${expectedPath} staging path`);
  }
}
const core = new URL(env.VITE_CORE_API_URL);
for (const key of ["VITE_ERP_API_URL", "VITE_ERP_USERS_API_URL"]) {
  const url = new URL(env[key]);
  if (url.origin !== core.origin || url.pathname.replace(/\/$/, "") !== "/cotizador-staging/api/staging/erp") {
    throw new Error(`${key} must point to the authenticated staging core ERP bridge.`);
  }
}
for (const [key, expected] of [["VITE_ERP_PRODUCTS_BASE_PATH", "/products"],
  ["VITE_ERP_CUSTOMERS_BASE_PATH", "/customers"], ["VITE_ERP_USERS_BASE_PATH", "/users"]]) {
  if (env[key] !== expected) throw new Error(`${key} must be ${expected} in staging.`);
}
for (const [key, value] of Object.entries(env)) {
  if (value && /(SECRET|TOKEN|PASSWORD|API_KEY|JWT_SEED)/i.test(key)) {
    throw new Error(`Do not include server secrets in browser environment variable ${key}.`);
  }
}
console.log("Staging frontend URLs validated.");
