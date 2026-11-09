import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/modules/quotes/utils/quote-item-selection.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { canRemoveQuoteItems, selectedQuoteItemIds, toggleQuoteItemSelection, removeQuoteItems } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("bulk deletion is restricted to editable system quotes", () => {
  for (const status of ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"]) {
    assert.equal(canRemoveQuoteItems({ status, captureMethod: "SYSTEM" }), true);
    assert.equal(canRemoveQuoteItems({ status, captureMethod: "EXCEL_IMPORT" }), false);
  }
  for (const status of ["COTIZADA", "APROBADA", "RECHAZADA", "CANCELADA", "REEMPLAZADA", "PENDIENTE_APROBACION", "UNKNOWN"]) {
    assert.equal(canRemoveQuoteItems({ status, captureMethod: "SYSTEM" }), false);
  }
});

test("selection only includes visible current items and ignores stale or duplicate ids", () => {
  const visible = [{ id: "c" }, { id: "a" }];
  assert.deepEqual(selectedQuoteItemIds(visible, ["a", "a", "b", "gone", "c"]), ["c", "a"]);
  assert.deepEqual(selectedQuoteItemIds([], ["a"]), []);
});

test("row selection can be toggled without mutating or duplicating ids", () => {
  const original = Object.freeze(["a"]);
  assert.deepEqual(toggleQuoteItemSelection(original, "b", true), ["a", "b"]);
  assert.deepEqual(toggleQuoteItemSelection(original, "a", true), ["a"]);
  assert.deepEqual(toggleQuoteItemSelection(original, "a", false), []);
  assert.deepEqual(original, ["a"]);
});

test("bulk removal preserves order, references and original data of remaining items", () => {
  const items = [{ id: "a", subtotal: 10 }, { id: "b", subtotal: 20 }, { id: "c", subtotal: 30 }];
  const remaining = removeQuoteItems(items, ["a", "a", "c", "unknown"]);
  assert.deepEqual(remaining.map(item => item.id), ["b"]);
  assert.equal(remaining[0], items[1]);
  assert.equal(items.length, 3);
  assert.equal(removeQuoteItems(items, []), items);
  assert.equal(removeQuoteItems(items, ["unknown"]), items);
  assert.deepEqual(removeQuoteItems(items, ["a", "b", "c"]), []);
});
