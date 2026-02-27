import { ChevronsLeftIcon, ChevronsRightIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import { useQuotes } from "../../queries/quotes/quotes-queries";
import { QuotesTable } from "../../shared/components/tables/QuotesTable";

const PAGE_SIZE = 10;

export const QuotesPage = () => {
  const [page, setPage] = useState(1);

  const { data, isFetching } = useQuotes({ page, pageSize: PAGE_SIZE });

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
        </div>

        <NavLink
          to="/cotizador"
          className="rounded-md bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-2 text-xs font-semibold text-white hover:from-sky-600 hover:to-indigo-600"
        >
          Nuevo cotizador
        </NavLink>
      </div>

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
