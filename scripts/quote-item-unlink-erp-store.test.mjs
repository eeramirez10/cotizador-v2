import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const memory = new Map();
let writes = 0;
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { writes += 1; memory.set(key, value); },
  removeItem: key => memory.delete(key),
} });
Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: globalThis.localStorage } });
after(() => {
  if (oldStorage) Object.defineProperty(globalThis, "localStorage", oldStorage);
  else delete globalThis.localStorage;
  if (oldWindow) Object.defineProperty(globalThis, "window", oldWindow);
  else delete globalThis.window;
});

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/store/quote/manual-quote.store.ts", import.meta.url))],
  bundle: true, platform: "node", format: "esm", packages: "external", write: false,
});
const compiled = bundled.outputFiles[0].text.replace(/from "(zustand(?:\/middleware)?)"/g,
  (_, module) => `from ${JSON.stringify(import.meta.resolve(module))}`);
const { useManualQuoteStore: store } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const product = { code: "01-00123", ean: "VB2F500", description: "VALVULA ERP", unit: "M",
  costUsd: 100, costCurrency: "MXN", saleCurrency: "USD", stock: 10 };

function seed() {
  store.getState().clearDraft();
  store.getState().setItemsFromExtraction(["VALVULA SOLICITADA", "TUBO SOLICITADO"].map(name => ({
    description_original: name, description_normalizada: name, cantidad: 2,
    unidad_original: "PZ", unidad_normalizada: "PZ", idioma: "es", requiere_revision: false,
  })));
  const id = store.getState().draft.items[0].id;
  store.getState().assignErpProductToItem(id, product);
  store.getState().setItemComment(id, "Con certificado");
  return store.getState().draft;
}

test("unlinking preserves customer data, row identity and siblings, clearing ERP data atomically", () => {
  const draft = seed();
  const item = draft.items[0];
  let updates = 0;
  const unsubscribe = store.subscribe(() => { updates += 1; });
  const previousWrites = writes;
  store.getState().unlinkErpProductFromItem(item.id);
  unsubscribe();
  const state = store.getState();
  const cleared = state.draft.items[0];
  assert.equal(updates, 1);
  assert.equal(writes - previousWrites, 1);
  assert.equal(state.draft.id, draft.id);
  assert.equal(state.draft.items[1], draft.items[1]);
  for (const key of ["id", "qty", "customerDescription", "customerDescriptionOriginal", "itemComment"]) {
    assert.equal(cleared[key], item[key], key);
  }
  for (const key of ["erpCode", "ean", "erpDescription"]) assert.equal(cleared[key], "", key);
  assert.equal(cleared.localProductId, null);
  assert.equal(cleared.stock, 0);
  assert.equal(cleared.costUsd, 0);
  assert.equal(cleared.erpSaleCurrency, null);
  assert.equal(cleared.unit, "PZ");
  assert.equal(cleared.sellerCostSource, null);
  assert.equal(cleared.deliveryTime, "Por definir");
  assert.equal(cleared.unitPrice, 0);
  assert.equal(cleared.requiresReview, true);
  assert.equal(JSON.parse(memory.get("cotizador-v2-manual-quote-draft")).state.draft.items[0].erpCode, "");
});

test("manual sales prices are preserved without retaining the wrong ERP cost or margin", () => {
  const draft = seed();
  store.getState().setItemUnitPrice(draft.items[0].id, 350);
  store.getState().unlinkErpProductFromItem(draft.items[0].id);
  const item = store.getState().draft.items[0];
  assert.equal(item.manualUnitPrice, 350);
  assert.equal(item.unitPrice, 350);
  assert.equal(item.subtotal, 700);
  assert.equal(item.marginPct, 0);
});

test("supplier references and technical data survive and become the valid pricing source", () => {
  const draft = seed();
  const original = { ...draft.items[0], sellerSupplierId: "supplier-local", sellerSupplierName: "Proveedor",
    sellerQuotedUnitCost: 80, sellerQuotedCurrency: "MXN", sellerCostSource: "ERP_COST",
    sellerSupplierQuoteReference: "REF-100", sellerSupplierDescription: "VALVULA DEL PROVEEDOR",
    sellerSupplierDeliveryTime: "3 dias", technicalFamily: "VALVULAS", technicalAttributes: { material: "ACERO" },
    effectiveCostAtQuote: 100, effectiveCostVariance: 10, effectiveCostEvaluatedAt: "2026-11-09" };
  store.setState({ draft: { ...draft, items: [original, draft.items[1]] } });
  store.getState().unlinkErpProductFromItem(original.id);
  const item = store.getState().draft.items[0];
  for (const key of ["sellerSupplierId", "sellerSupplierName", "sellerQuotedUnitCost", "sellerQuotedCurrency",
    "sellerSupplierQuoteReference", "sellerSupplierDescription", "technicalFamily", "technicalAttributes"]) {
    assert.equal(item[key], original[key], key);
  }
  assert.equal(item.sellerCostSource, "SELLER_SUPPLIER_QUOTE");
  assert.equal(item.deliveryTime, "3 dias");
  assert.equal(item.unitPrice, 92);
  assert.equal(item.effectiveCostAtQuote, undefined);
  assert.equal(item.effectiveCostVariance, undefined);
  assert.equal(item.effectiveCostEvaluatedAt, null);
});

test("a directly added ERP product retains its description as customer reference", () => {
  const draft = seed();
  const original = { ...draft.items[0], customerDescription: "", customerDescriptionOriginal: "", customerUnit: "" };
  store.setState({ draft: { ...draft, items: [original] } });
  store.getState().unlinkErpProductFromItem(original.id);
  const item = store.getState().draft.items[0];
  assert.equal(item.customerDescription, product.description);
  assert.equal(item.customerDescriptionOriginal, product.description);
  assert.equal(item.unit, product.unit);
});

test("locked statuses, Excel items and missing links are not modified", () => {
  const draft = seed();
  for (const status of ["COTIZADA", "APROBADA", "PENDIENTE_APROBACION", "CANCELADA", "RECHAZADA", "REEMPLAZADA"]) {
    store.setState({ draft: { ...draft, status } });
    const before = store.getState().draft;
    store.getState().unlinkErpProductFromItem(before.items[0].id);
    assert.equal(store.getState().draft, before, status);
  }
  for (const guardedDraft of [
    { ...draft, captureMethod: "EXCEL_IMPORT" },
    { ...draft, items: [{ ...draft.items[0], importedFromExcel: true }] },
    { ...draft, items: [{ ...draft.items[0], erpCode: "" }] },
  ]) {
    store.setState({ draft: guardedDraft });
    store.getState().unlinkErpProductFromItem(guardedDraft.items[0].id);
    assert.equal(store.getState().draft, guardedDraft);
  }
  store.setState({ draft });
  store.getState().unlinkErpProductFromItem("missing-item");
  assert.equal(store.getState().draft, draft);
});

test("editable states allow unlinking and relinking to the correct ERP product", () => {
  for (const status of ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"]) {
    const draft = seed();
    store.setState({ draft: { ...draft, status } });
    const id = draft.items[0].id;
    store.getState().unlinkErpProductFromItem(id);
    assert.equal(store.getState().draft.items[0].erpCode, "");
    store.getState().assignErpProductToItem(id, { ...product, code: "01-00456" });
    assert.equal(store.getState().draft.items[0].erpCode, "01-00456");
    assert.equal(store.getState().draft.items[0].qty, 2);
    assert.equal(store.getState().draft.items[0].customerDescription, draft.items[0].customerDescription);
  }
});
