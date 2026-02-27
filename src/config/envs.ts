const pickFirst = (...values: Array<string | undefined>): string => {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return "";
};

const normalizePath = (path: string): string => {
  if (!path) return path;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return path.startsWith("/") ? path : `/${path}`;
};

export const envs = {
  ERP_API_URL: pickFirst(
    import.meta.env.VITE_ERP_API_URL,
    import.meta.env.PROD ? import.meta.env.VITE_ERP_PROD : import.meta.env.VITE_ERP_DEV
  ),
  ERP_PRODUCTS_BASE_PATH: normalizePath(pickFirst(import.meta.env.VITE_ERP_PRODUCTS_BASE_PATH, "/api/erp/products")),
  AI_API_URL: pickFirst(
    import.meta.env.VITE_AI_API_URL,
    import.meta.env.VITE_QUOTE_EXTRACTOR_API_URL,
    import.meta.env.VITE_EXTRACTOR_API_URL,
    "http://localhost:4500"
  ),
};
