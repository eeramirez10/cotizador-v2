import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const compiled = await build({ entryPoints: ["src/modules/reports/report-filters.ts"], bundle: true, platform: "node", format: "esm", write: false });
const { initialReportFilters, reportPeriod, validateReportFilters } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);

test("presets use the selected local date, including week and month boundaries", () => {
  const date = new Date("2026-11-01T02:00:00Z"); // Still October in Mexico.
  assert.deepEqual(reportPeriod("MONTH_TO_DATE", "America/Mexico_City", date), { from: "2026-10-01", to: "2026-10-31" });
  assert.deepEqual(reportPeriod("PREVIOUS_MONTH", "America/Mexico_City", date), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(reportPeriod("PREVIOUS_WEEK", "America/Mexico_City", new Date("2026-11-18T12:00:00Z")), { from: "2026-11-09", to: "2026-11-15" });
});
test("dates are validated before querying and reports default to separate currencies", () => {
  const initial = initialReportFilters();
  assert.equal(initial.currency, "ALL");
  assert.equal(initial.includeDetails, false);
  assert.equal(validateReportFilters(initial), null);
  for (const values of [{ from: "2026-02-30" }, { from: "2027-12-01", to: "2026-12-01" }, { from: "2020-01-01" }]) {
    assert.ok(validateReportFilters({ ...initial, ...values }));
  }
});
test("reports are protected, lazy-loaded and distinct from automatic subscriptions", () => {
  const routes = readFileSync("src/app/router.tsx", "utf8");
  assert.match(routes, /path: "reports",[\s\S]*?requireRolesLoader\(\["admin", "manager", "seller"\]\)/);
  assert.match(routes, /import\("\.\.\/pages\/reports\/commercial-reports.page"\)/);
  const page = readFileSync("src/pages/reports/commercial-reports.page.tsx", "utf8");
  assert.match(page, /No hay cotizaciones/);
  assert.match(page, /URL.revokeObjectURL/);
  assert.match(page, /signal.*CommercialReportsService.get/);
  assert.doesNotMatch(page, /api\/public|sendNow/);
});
