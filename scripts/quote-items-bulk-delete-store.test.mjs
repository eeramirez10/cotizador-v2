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

function seed() {
  store.getState().clearDraft();
  store.getState().setClient({ id: "client-local", name: "Cliente", lastname: "Local", companyName: "Local", email: "local@example.test" });
  store.getState().setPaymentTerms("CONTADO");
  store.getState().setItemsFromExtraction(["A", "B", "C"].map(name => ({
    description_original: name, description_normalizada: name, cantidad: 2,
    unidad_original: "PZ", unidad_normalizada: "PZ", idioma: "es", requiere_revision: false,
  })));
  for (const [index, item] of store.getState().draft.items.entries()) store.getState().setItemUnitPrice(item.id, (index + 1) * 10);
  return store.getState().draft;
}

test("bulk deletion updates the real store and persistence once, recalculating quote totals", () => {
  const draft = seed();
  let updates = 0;
  const unsubscribe = store.subscribe(() => { updates += 1; });
  const previousWrites = writes;
  store.getState().removeItems([draft.items[0].id, draft.items[2].id]);
  unsubscribe();
  const state = store.getState();
  assert.equal(updates, 1);
  assert.equal(writes - previousWrites, 1);
  assert.deepEqual(state.draft.items.map(item => item.id), [draft.items[1].id]);
  assert.equal(state.draft.items[0], draft.items[1]);
  assert.equal(state.draft.id, draft.id);
  assert.equal(state.draft.currency, draft.currency);
  assert.equal(state.draft.status, draft.status);
  assert.equal(state.draft.client, draft.client);
  assert.equal(state.draft.paymentTerms, draft.paymentTerms);
  assert.equal(state.subtotal(), 40);
  assert.equal(state.tax(), 6.4);
  assert.equal(state.total(), 46.4);
  const saved = JSON.parse(memory.get("cotizador-v2-manual-quote-draft"));
  assert.deepEqual(saved.state.draft.items.map(item => item.id), [draft.items[1].id]);
});

test("removing all rows keeps the quote context and returns zero totals", () => {
  const draft = seed();
  store.getState().removeItems(draft.items.map(item => item.id));
  const state = store.getState();
  assert.deepEqual(state.draft.items, []);
  assert.equal(state.draft.id, draft.id);
  assert.equal(state.draft.exchangeRate, draft.exchangeRate);
  assert.equal(state.draft.client, draft.client);
  assert.equal(state.total(), 0);
});

test("locked quotes and Excel imports cannot be bulk deleted through the store", () => {
  const draft = seed();
  for (const status of ["COTIZADA", "APROBADA", "PENDIENTE_APROBACION", "CANCELADA"]) {
    store.setState({ draft: { ...draft, status } });
    const before = store.getState().draft;
    store.getState().removeItems(before.items.map(item => item.id));
    assert.equal(store.getState().draft, before);
  }
  store.setState({ draft: { ...draft, captureMethod: "EXCEL_IMPORT" } });
  const imported = store.getState().draft;
  store.getState().removeItems(imported.items.map(item => item.id));
  assert.equal(store.getState().draft, imported);
});
