import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const fixtureKey = "__erpInventoryServiceFixture";
const previous = globalThis[fixtureKey];
after(() => {
  if (previous === undefined) delete globalThis[fixtureKey];
  else globalThis[fixtureKey] = previous;
});
const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/modules/inventory/erp-inventory.service.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", packages: "external", write: false,
  plugins: [{ name: "isolated-inventory-http", setup(build) {
    build.onResolve({ filter: /auth\.store$|core-http\.client$/ }, args => ({ path: args.path, namespace: "fixture" }));
    build.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: `
      export const getAuthToken = () => globalThis.${fixtureKey}.token;
      export const coreHttpClient = {
        get: (...args) => globalThis.${fixtureKey}.get(...args),
        put: (...args) => globalThis.${fixtureKey}.put(...args),
      };
    ` }));
  } }],
});
const compiled = bundled.outputFiles[0].text.replace(/from "axios"/g, `from ${JSON.stringify(import.meta.resolve("axios"))}`);
const { ErpInventoryService, normalizeInventorySearch } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const filters = { query: "TSC", warehouseCode: "06", stock: "zero", page: 2, pageSize: 25, sortBy: "stock", sortDirection: "desc" };

test("inventory search normalization uses NFC, trimming and uppercase without modifying typed filters", async () => {
  for (const input of ["TSC", "tsc", " TsC "]) assert.equal(normalizeInventorySearch(input), "TSC");
  assert.equal(normalizeInventorySearch(" va\u0301lvula "), "VÁLVULA");
  const input = { ...filters, query: " tSc ", warehouseCode: "|" };
  globalThis[fixtureKey] = { token: "session", get: async (_path, options) => {
    assert.equal(options.params.query, "TSC");
    assert.equal(options.params.warehouseCode, "|");
    return { data: { items: [] } };
  } };
  await ErpInventoryService.list(input);
  assert.equal(input.query, " tSc ");
});

test("inventory browser uses the core endpoint, bearer token, filters and abort signal only", async () => {
  const controller = new AbortController();
  globalThis[fixtureKey] = { token: "fixture-session", get: async (path, options) => {
    assert.equal(path, "/api/inventory/erp");
    assert.deepEqual(options.params, filters);
    assert.equal(options.signal, controller.signal);
    assert.deepEqual(options.headers, { Authorization: "Bearer fixture-session" });
    return { data: { items: [], total: 0 } };
  } };
  assert.deepEqual(await ErpInventoryService.list(filters, controller.signal), { items: [], total: 0 });
});

test("warehouse picker uses the read-only core endpoint and refuses missing authentication", async () => {
  globalThis[fixtureKey] = { token: "session", get: async (path, options) => {
    assert.equal(path, "/api/inventory/erp/warehouses");
    assert.equal(options.params, undefined);
    return { data: [{ code: "06", name: "Cancún" }] };
  } };
  assert.equal((await ErpInventoryService.warehouses())[0].code, "06");
  globalThis[fixtureKey] = { token: "", get: () => assert.fail("Must not request with no token") };
  await assert.rejects(ErpInventoryService.list(filters), /Inicia sesión/);
});

test("inventory errors preserve useful server messages and request cancellations", async () => {
  globalThis[fixtureKey] = { token: "session", get: async () => { throw { isAxiosError: true, response: { data: { error: "Tiempo de espera del ERP." } } }; } };
  await assert.rejects(ErpInventoryService.list(filters), /Tiempo de espera del ERP/);
  const cancellation = { __CANCEL__: true };
  globalThis[fixtureKey].get = async () => { throw cancellation; };
  await assert.rejects(ErpInventoryService.list(filters), error => error === cancellation);
});

test("visibility settings use the authenticated core endpoint and preserve all, empty and selected modes", async () => {
  const warehouses = [{ code: "06", name: "Cancún" }, { code: "|", name: "Almacén |" }];
  globalThis[fixtureKey] = { token: "admin", get: async (path, options) => {
    assert.equal(path, "/api/inventory/erp/settings");
    assert.deepEqual(options.headers, { Authorization: "Bearer admin" });
    return { data: { warehouseCodes: null, warehouses } };
  }, put: async (path, body, options) => {
    assert.equal(path, "/api/inventory/erp/settings");
    assert.deepEqual(options.headers, { Authorization: "Bearer admin" });
    return { data: { ...body, warehouses } };
  } };
  assert.deepEqual(await ErpInventoryService.settings(), { warehouseCodes: null, warehouses });
  for (const warehouseCodes of [null, [], ["06", "|"]]) {
    assert.deepEqual(await ErpInventoryService.saveSettings(warehouseCodes), { warehouseCodes, warehouses });
  }
  globalThis[fixtureKey] = { token: "", put: () => assert.fail("Must not request with no token") };
  await assert.rejects(ErpInventoryService.saveSettings(null), /Inicia sesión/);
});
