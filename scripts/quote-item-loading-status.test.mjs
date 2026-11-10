import assert from "node:assert/strict";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { build } from "esbuild";

const bundled = await build({
  entryPoints: [fileURLToPath(new URL("../src/shared/components/quotes/quote-item-loading-status.tsx", import.meta.url))],
  bundle: true, platform: "node", format: "esm", packages: "external", write: false, jsx: "automatic",
});
const compiled = bundled.outputFiles[0].text.replace(/from "(react(?:\/jsx-runtime)?|lucide-react)"/g,
  (_, module) => `from ${JSON.stringify(import.meta.resolve(module))}`);
const { QuoteItemLoadingStatus } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("loading status spans the current table and announces which item is being created", () => {
  const html = renderToStaticMarkup(createElement(QuoteItemLoadingStatus, { colSpan: 16, position: 3 }));
  assert.match(html, /<tr/);
  assert.match(html, /colSpan="16"/);
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /aria-atomic="true"/);
  assert.match(html, /Creando producto local/);
  assert.match(html, /para la partida 3\./);
});

test("status remains separate from actions, supports narrow viewports and reduced motion", () => {
  const html = renderToStaticMarkup(createElement(QuoteItemLoadingStatus, { colSpan: 12, position: 1 }));
  assert.match(html, /sticky left-2/);
  assert.match(html, /max-w-\[calc\(100vw-4rem\)\]/);
  assert.match(html, /motion-safe:animate-spin/);
  assert.match(html, /aria-hidden="true"/);
  assert.doesNotMatch(html, /<button|<input/);
});
