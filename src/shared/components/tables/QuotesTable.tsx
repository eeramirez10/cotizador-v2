import { type FC } from "react";
import { NavLink } from "react-router";
import type { Quote } from "../../../modules/quotes/types/quote.types";

interface Props {
  quotes?: Quote[];
  isLoading: boolean;
}

export const QuotesTable: FC<Props> = ({ quotes, isLoading }) => {
  if (isLoading) {
    return <QuotesTableSkelleton items={quotes?.length ?? 10} />;
  }

  return (
    <>
      <table className="min-w-full divide-y divide-gray-200 overflow-x-auto">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              N° Cotizacion
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Cliente
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Vendedor
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estatus
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 bg-white">
          {(!quotes || quotes.length === 0) && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-sm text-gray-500">
                Aun no has generado cotizaciones.
              </td>
            </tr>
          )}

          {quotes?.map((quote) => (
            <tr key={quote.id} className="quote-item hover:bg-gray-50">
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">#{quote.quoteNumber}</td>
              <td className="whitespace-nowrap px-6 py-4">
                <div className="flex items-center">
                  <img
                    className="h-8 w-8 rounded-full"
                    src="https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png"
                    alt="Client picture"
                  />
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-900">
                      {quote?.customer?.name} {quote?.customer?.lastname}
                    </p>
                    <p className="text-sm text-gray-500">{quote?.customer?.phone}</p>
                  </div>
                </div>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">{quote.createdByName || "-"}</td>
              <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">{quote.createdAt}</td>
              <td className="whitespace-nowrap px-6 py-4 text-xs">
                <span
                  className={`rounded-full px-2 py-1 font-semibold ${
                    quote.status === "COTIZADA"
                      ? "bg-emerald-100 text-emerald-700"
                      : quote.status === "BORRADOR"
                        ? "bg-slate-100 text-slate-700"
                        : quote.status === "CANCELADA"
                          ? "bg-rose-100 text-rose-700"
                          : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {quote.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
                <NavLink className="mr-3 text-blue-600 hover:text-blue-900" to={`/quotes/${quote.id}`}>
                  Ver
                </NavLink>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
};

interface QuotesTableSkelletonProps {
  items: number;
}

const QuotesTableSkelleton: React.FC<QuotesTableSkelletonProps> = (props) => {
  const { items = 1 } = props;

  return (
    <div className="min-w-full animate-pulse divide-y divide-gray-200 overflow-x-auto">
      <div className="flex justify-between bg-gray-50">
        <div className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ">N° Cotizacion</div>
        <div className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ">Cliente</div>
        <div className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 ">Vendedor</div>
        <div className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Fecha</div>
        <div className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Estatus</div>
        <div className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">Acciones</div>
      </div>

      <div className="divide-y divide-gray-200 bg-white">
        {Array.from({ length: items }).map((_, index) => (
          <div key={index} className="quote-item flex justify-between hover:bg-gray-50">
            <div className="px-6 py-4 ">
              <div className="h-2 w-10 bg-gray-300"></div>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center">
                <div className="h-8 w-8 rounded-full bg-gray-300"></div>
                <div className="ml-3">
                  <div className="mb-2 h-2 w-20 bg-gray-300"></div>
                  <div className="h-2 w-10 bg-gray-300"></div>
                </div>
              </div>
            </div>
            <div className="px-6 py-4 ">
              <div className="mb-2 h-2 w-20 bg-gray-300"></div>
            </div>
            <div className="px-6 py-4 ">
              <div className="mb-2 h-2 w-20 bg-gray-300"></div>
            </div>
            <div className="px-6 py-4 ">
              <div className="mb-2 h-2 w-12 bg-gray-300"></div>
            </div>
            <div className="whitespace-nowrap px-6 py-4 text-right text-sm font-medium">
              <div className="mb-2 h-2 w-10 bg-gray-300"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
