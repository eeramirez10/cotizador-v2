import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const validator = resolve("scripts/validate-staging-env.mjs");
function validate(change = {}) {
  const root = mkdtempSync(resolve(tmpdir(), "staging-frontend-"));
  const core = "https://gateway.example/cotizador-staging";
  const values = {
    VITE_CORE_API_URL: core, VITE_AI_API_URL: "https://gateway.example/ia-staging",
    VITE_ERP_API_URL: `${core}/api/staging/erp`, VITE_ERP_USERS_API_URL: `${core}/api/staging/erp`,
    VITE_ERP_PRODUCTS_BASE_PATH: "/products", VITE_ERP_CUSTOMERS_BASE_PATH: "/customers", VITE_ERP_USERS_BASE_PATH: "/users", ...change,
  };
  try {
    writeFileSync(resolve(root, ".env.staging"), Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n"));
    const env = { ...process.env };
    for (const key of Object.keys(env)) if (key.startsWith("VITE_")) delete env[key];
    return spawnSync(process.execPath, [validator], { cwd: root, encoding: "utf8", env });
  } finally { rmSync(root, { recursive: true, force: true }); }
}
test("staging browser uses only staging APIs and authenticated ERP bridge", () => {
  const result = validate();
  assert.equal(result.status, 0, result.stderr);
});
test("staging browser rejects production URLs and direct ERP access", () => {
  for (const change of [{ VITE_CORE_API_URL: "https://gateway.example/cotizador" },
    { VITE_ERP_API_URL: "https://erp-production.example" }, { VITE_ERP_USERS_API_URL: "https://erp-production.example" }]) {
    assert.notEqual(validate(change).status, 0);
  }
});
test("staging browser rejects server secrets in Vite variables", () => {
  assert.notEqual(validate({ VITE_INTERNAL_API_KEY: "must-not-be-public" }).status, 0);
});
