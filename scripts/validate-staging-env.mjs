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
if (env.VITE_ERP_API_URL) {
  throw new Error("VITE_ERP_API_URL must remain empty until a staging-safe ERP endpoint is configured.");
}
console.log("Staging frontend URLs validated.");
