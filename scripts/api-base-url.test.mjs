import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("../src/shared/utils/api-base-url.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const { isSameApiBaseUrl } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("AI auth applies to the same core endpoint with optional trailing slash", () => {
  assert.equal(isSameApiBaseUrl("https://gateway.example/cotizador-staging/", "https://gateway.example/cotizador-staging"), true);
  assert.equal(isSameApiBaseUrl("http://localhost:4600", "http://localhost:4600/"), true);
  assert.equal(isSameApiBaseUrl("https://gateway.example/cotizador", "https://gateway.example/cotizador/"), true);
});

test("shared hostname does not authorize a different proxy path", () => {
  for (const ai of ["https://gateway.example/ia-staging", "https://gateway.example/cotizador", "https://gateway.example/cotizador-staging-other"]) {
    assert.equal(isSameApiBaseUrl(ai, "https://gateway.example/cotizador-staging"), false);
  }
});

test("different origins and malformed or credential-bearing base URLs fail closed", () => {
  for (const ai of ["", "not-a-url", "/cotizador-staging", "http://localhost:4700", "https://other.example/cotizador-staging", "https://user:password@gateway.example/cotizador-staging", "https://gateway.example/cotizador-staging?secret=value", "https://gateway.example/cotizador-staging#fragment"]) {
    assert.equal(isSameApiBaseUrl(ai, "https://gateway.example/cotizador-staging"), false);
  }
});
