import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, type FC, useState } from "react";
import { NavLink } from "react-router";
import type { Quote } from "../../../modules/quotes/types/quote.types";

interface Props {
  quotes?: Quote[];
  isLoading: boolean;
}

const statusClasses = (status: Quote["status"]): string => {
  if (status === "COTIZADA") return "bg-emerald-100 text-emerald-700";
  if (status === "PENDIENTE_APROBACION") return "bg-cyan-100 text-cyan-700";
  if (status === "CAMBIOS_SOLICITADOS") return "bg-amber-100 text-amber-800";
  if (status === "APROBADA") return "bg-blue-100 text-blue-700";
  if (status === "RECHAZADA") return "bg-orange-100 text-orange-700";
  if (status === "BORRADOR") return "bg-slate-100 text-slate-700";
  if (status === "CANCELADA") return "bg-rose-100 text-rose-700";
  if (status === "REEMPLAZADA") return "bg-gray-200 text-gray-700";
  return "bg-amber-100 text-amber-700";
};

const versionLabel = (quote: Quote): string =>
  quote.revisionNumber > 0 ? `R${String(quote.revisionNumber).padStart(2, "0")}` : "Original";

interface QuoteRowProps {
  quote: Quote;
  isPreviousVersion?: boolean;
  isExpanded?: boolean;
  versionCount?: number;
  onToggle?: () => void;
}

const QuoteRow: FC<QuoteRowProps> = ({
  quote,
  isPreviousVersion = false,
  isExpanded = false,
  versionCount = 0,
  onToggle,
}) => (
  <tr className={isPreviousVersion ? "bg-slate-50/80 hover:bg-slate-100" : "quote-item hover:bg-gray-50"}>
    <td className={`whitespace-nowrap px-6 py-4 text-sm font-medium ${isPreviousVersion ? "border-l-2 border-slate-300 text-gray-700" : "text-gray-900"}`}>
      <div className={`flex items-center gap-2 ${isPreviousVersion ? "pl-7" : ""}`}>
        {!isPreviousVersion && versionCount > 0 ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Ocultar versiones anteriores" : "Mostrar versiones anteriores"}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : !isPreviousVersion ? (
          <span className="h-7 w-7" aria-hidden="true" />
        ) : null}

        <div>
          <div className="flex items-center gap-2">
            <span>#{quote.quoteNumber}</span>
            {isPreviousVersion ? (
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                {versionLabel(quote)}
              </span>
            ) : versionCount > 0 ? (
              <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">Actual</span>
            ) : null}
          </div>
          {!isPreviousVersion && versionCount > 0 && (
            <p className="mt-1 text-[11px] font-normal text-slate-500">
              {versionCount} {versionCount === 1 ? "versión anterior" : "versiones anteriores"}
            </p>
          )}
        </div>
      </div>
    </td>
    <td className="whitespace-nowrap px-6 py-4">
      <div className="flex items-center">
        <img
          className={`h-8 w-8 rounded-full ${isPreviousVersion ? "opacity-70" : ""}`}
          src="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
          alt=""
        />
        <div className="ml-3">
          <p className="text-sm font-medium text-gray-900">
            {quote.customer?.company || `${quote.customer?.name || ""} ${quote.customer?.lastname || ""}`.trim()}
          </p>
          <p className="text-sm text-gray-500">{quote.customer?.phone}</p>
        </div>
      </div>
    </td>
    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{quote.createdByName || "-"}</td>
    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{quote.providedByName || "Directa"}</td>
    <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{quote.createdAt}</td>
    <td className="whitespace-nowrap px-6 py-4 text-xs">
      <span className={`rounded-full px-2 py-1 font-semibold ${quote.captureMethod === "EXCEL_IMPORT" ? "bg-teal-100 text-teal-700" : "bg-slate-100 text-slate-600"}`}>
        {quote.captureMethod === "EXCEL_IMPORT" ? "EXCEL" : "SISTEMA"}
      </span>
    </td>
    <td className="whitespace-nowrap px-6 py-4 text-xs">
      <span className={`rounded-full px-2 py-1 font-semibold ${statusClasses(quote.status)}`}>{quote.status}</span>
    </td>
    <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
      <NavLink className="text-blue-600 hover:text-blue-900" to={`/quotes/${quote.id}`}>
        Ver
      </NavLink>
    </td>
  </tr>
);

export const QuotesTable: FC<Props> = ({ quotes, isLoading }) => {
  const [expandedQuotes, setExpandedQuotes] = useState<Set<string>>(() => new Set());

  if (isLoading) return <QuotesTableSkeleton items={quotes?.length ?? 10} />;

  const toggleVersions = (quoteId: string) => {
    setExpandedQuotes((current) => {
      const next = new Set(current);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  };

  return (
    <table className="min-w-full divide-y divide-gray-200 overflow-x-auto">
      <thead className="bg-gray-50">
        <tr>
          {[
            "N° Cotización",
            "Cliente",
            "Vendedor",
            "Proporcionada por",
            "Fecha",
            "Captura",
            "Estatus",
            "Acciones",
          ].map((label) => (
            <th key={label} scope="col" className={`px-6 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 ${label === "Acciones" ? "text-right" : "text-left"}`}>
              {label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 bg-white">
        {(!quotes || quotes.length === 0) && (
          <tr>
            <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-500">Aún no has generado cotizaciones.</td>
          </tr>
        )}

        {quotes?.map((quote) => {
          const relatedVersions = quote.relatedVersions ?? [];
          const isExpanded = expandedQuotes.has(quote.id);
          return (
            <Fragment key={quote.id}>
              <QuoteRow
                quote={quote}
                versionCount={relatedVersions.length}
                isExpanded={isExpanded}
                onToggle={() => toggleVersions(quote.id)}
              />
              {isExpanded && relatedVersions.map((version) => (
                <QuoteRow key={version.id} quote={version} isPreviousVersion />
              ))}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

const QuotesTableSkeleton: FC<{ items: number }> = ({ items }) => (
  <div className="min-w-full animate-pulse divide-y divide-gray-200">
    <div className="h-11 bg-gray-50" />
    {Array.from({ length: items }).map((_, index) => (
      <div key={index} className="flex h-16 items-center gap-8 px-6">
        <div className="h-3 w-32 rounded bg-gray-200" />
        <div className="h-8 w-48 rounded bg-gray-200" />
        <div className="h-3 w-28 rounded bg-gray-200" />
        <div className="h-3 flex-1 rounded bg-gray-200" />
      </div>
    ))}
  </div>
);
