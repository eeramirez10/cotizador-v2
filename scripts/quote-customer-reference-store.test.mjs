import assert from "node:assert/strict";
import { after, test } from "node:test";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const memory = new Map();
const oldStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
const oldWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => { memory.set(key, value); },
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

const extracted = [{
  description_original: "Tubo de acero", description_normalizada: "Tubo de acero", cantidad: 2,
  unidad_original: "toneladas", unidad_normalizada: "TON", idioma: "es", requiere_revision: false,
}];

test("an extracted reference is editable, persisted, and does not overwrite a manual reference", () => {
  store.getState().clearDraft();
  store.getState().setItemsFromExtraction(extracted, "RFQ-007");
  assert.equal(store.getState().draft.customerReference, "RFQ-007");
  assert.equal(store.getState().draft.detectedCustomerReference, "RFQ-007");
  assert.equal(store.getState().draft.items[0].unit, "TON");
  store.getState().setCustomerReference("MANUAL");
  store.getState().addItemsFromExtraction(extracted, "RFQ-008");
  assert.equal(store.getState().draft.customerReference, "MANUAL");
  assert.equal(store.getState().draft.detectedCustomerReference, "RFQ-008");
  store.getState().useDetectedCustomerReference();
  assert.equal(store.getState().draft.customerReference, "RFQ-008");
  store.getState().setItemsFromExtraction(extracted);
  assert.equal(store.getState().draft.customerReference, "RFQ-008");
  assert.equal(JSON.parse(memory.get("cotizador-v2-manual-quote-draft")).state.draft.customerReference, "RFQ-008");
});

test("a selected local unit replaces the item unit without touching the customer's original unit or quantity", () => {
  store.getState().clearDraft();
  store.getState().setItemsFromExtraction(extracted);
  const [item] = store.getState().draft.items;
  store.getState().assignLocalProductToItem(item.id, { id: "local-1", description: "Tubo", unit: "CAJ20" });
  const [linked] = store.getState().draft.items;
  assert.equal(linked.unit, "CAJ20");
  assert.equal(linked.customerUnit, "toneladas");
  assert.equal(linked.qty, 2);
});
