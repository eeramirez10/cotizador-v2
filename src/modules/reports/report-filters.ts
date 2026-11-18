import type { ReportFilters } from "./services/commercial-reports.service";

export const PERIODS = [
  ["MONTH_TO_DATE", "Mes actual"], ["PREVIOUS_MONTH", "Mes anterior"], ["WEEK_TO_DATE", "Semana actual"],
  ["PREVIOUS_WEEK", "Semana anterior"], ["LAST_7_DAYS", "Últimos 7 días"], ["LAST_30_DAYS", "Últimos 30 días"], ["CUSTOM", "Personalizado"],
] as const;
export const TIMEZONES = [
  ["America/Mexico_City", "Centro de México"], ["America/Monterrey", "Monterrey"], ["America/Cancun", "Cancún"],
  ["America/Chihuahua", "Chihuahua"], ["America/Hermosillo", "Hermosillo"], ["America/Mazatlan", "Mazatlán"], ["America/Tijuana", "Tijuana"],
] as const;
export function reportPeriod(preset: string, timezone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find(value => value.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const shift = (value: string, days: number) => new Date(Date.parse(value + "T00:00:00Z") + days * 86400000).toISOString().slice(0, 10);
  const start = today.slice(0, 8) + "01";
  const day = new Date(today + "T00:00:00Z").getUTCDay();
  const monday = shift(today, -(day === 0 ? 6 : day - 1));
  if (preset === "PREVIOUS_MONTH") { const to = shift(start, -1); return { from: to.slice(0, 8) + "01", to }; }
  if (preset === "PREVIOUS_WEEK") return { from: shift(monday, -7), to: shift(monday, -1) };
  if (preset === "WEEK_TO_DATE") return { from: monday, to: today };
  if (preset === "LAST_7_DAYS") return { from: shift(today, -6), to: today };
  if (preset === "LAST_30_DAYS") return { from: shift(today, -29), to: today };
  return { from: start, to: today };
}
export const initialReportFilters = (): ReportFilters => ({
  ...reportPeriod("MONTH_TO_DATE", "America/Mexico_City"), timezone: "America/Mexico_City",
  branchId: "", sellerId: "", currency: "ALL", statuses: [], sourceChannel: "", captureMethod: "",
  compare: false, includeBreakdowns: true, includeDetails: false,
});
export function validateReportFilters(filters: ReportFilters): string | null {
  const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date)) && new Date(date).toISOString().slice(0, 10) === date;
  if (!validDate(filters.from) || !validDate(filters.to)) return "Selecciona fechas válidas.";
  const days = (Date.parse(filters.to) - Date.parse(filters.from)) / 86400000 + 1;
  if (days < 1 || days > 366) return "El periodo debe tener entre 1 y 366 días.";
  return null;
}
