import { ChevronsLeftIcon, ChevronsRightIcon, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { NavLink } from "react-router";
import { useQuotes } from "../../queries/quotes/quotes-queries";
import { QuotesTable } from "../../shared/components/tables/QuotesTable";
import { useAuthStore } from "../../store/auth/auth.store";

const PAGE_SIZE = 10;

export const QuotesPage = () => {
  const [page, setPage] = useState(1);
  const [showArchived, setShowArchived] = useState(false);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const user = useAuthStore((state) => state.user);
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  const { data, isFetching } = useQuotes({ page, pageSize: PAGE_SIZE, search, archived: showArchived });

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearch(searchDraft.trim());
    setPage(1);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow">
            Todas
          </button>
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow">
            Pendientes
          </button>
          <button className="rounded-md border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-800 shadow">
            Aprobadas
          </button>
          {isAdmin && (
            <button
              onClick={() => {
                setShowArchived((current) => !current);
                setPage(1);
              }}
              className={`rounded-md border px-4 py-2 text-xs font-semibold shadow ${
                showArchived ? "border-slate-800 bg-slate-800 text-white" : "border-gray-300 bg-white text-gray-800"
              }`}
            >
              {showArchived ? "Ver activas" : "Archivadas"}
            </button>
          )}
        </div>

        {!isAdmin && (
          <NavLink
            to="/cotizador/sistema"
            className="rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
          >
            Nuevo cotizador
          </NavLink>
        )}
      </div>

      <form onSubmit={submitSearch} className="mt-5 flex max-w-xl items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Buscar por cotización, folio ERP o cliente"
            className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
          />
          {searchDraft && (
            <button
              type="button"
              onClick={() => {
                setSearchDraft("");
                setSearch("");
                setPage(1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <button type="submit" className="rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
          Buscar
        </button>
      </form>

      <div className="mt-6 overflow-x-auto rounded-sm bg-white shadow-md">
        <QuotesTable quotes={data?.items} isLoading={isFetching} />

        <Pagination
          onPageChange={setPage}
          page={data?.page ?? 1}
          pageSize={data?.pageSize ?? 1}
          total={data?.total ?? 1}
          maxPagesToShow={3}
        />
      </div>
    </div>
  );
};

interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  maxPagesToShow: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({ page, pageSize, total, maxPagesToShow, onPageChange }) => {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    onPageChange(nextPage);
  };

  const getPages = (): (number | "dots")[] => {
    const pages: (number | "dots")[] = [];

    if (totalPages <= maxPagesToShow) {
      for (let index = 1; index <= totalPages; index++) {
        pages.push(index);
      }
      return pages;
    }

    const half = Math.floor(maxPagesToShow / 2);
    let start = Math.max(1, page - half);
    let end = Math.min(totalPages, page + half);

    if (start === 1) {
      end = Math.min(totalPages, start + maxPagesToShow - 1);
    } else if (end === totalPages) {
      start = Math.max(1, end - maxPagesToShow + 1);
    }

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push("dots");
    }

    for (let p = start; p <= end; p++) {
      pages.push(p);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push("dots");
      pages.push(totalPages);
    }

    return pages;
  };

  const pages = getPages();

  return (
    <div className="flex items-center justify-center p-4">
      <div className="flex w-full justify-between">
        <div className="mr-5 flex items-center justify-center text-sm text-gray-700">
          <span>
            {from}–{to} de {total}
          </span>
        </div>

        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={() => goToPage(1)}>
            <ChevronsLeftIcon />
          </button>

          <button onClick={() => goToPage(page - 1)} className="btn btn-primary">
            <ChevronLeft />
          </button>

          {pages.map((item, index) =>
            item === "dots" ? (
              <span key={`dots-${index}`} style={{ padding: "0 0.25rem" }}>
                …
              </span>
            ) : (
              <button
                key={item}
                onClick={() => goToPage(item)}
                disabled={item === page}
                className="btn btn-primary"
              >
                {item}
              </button>
            )
          )}

          <button className="btn btn-primary " onClick={() => goToPage(page + 1)} disabled={page === totalPages}>
            <ChevronRight />
          </button>

          <button onClick={() => goToPage(totalPages)} disabled={page === totalPages} className="btn btn-primary ">
            <ChevronsRightIcon />
          </button>
        </div>

        <div className="flex items-center justify-center text-sm text-gray-700">
          <span className="ml-5">
            Página {page} de {totalPages}
          </span>
        </div>
      </div>
    </div>
  );
};
