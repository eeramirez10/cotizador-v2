import { Loader2 } from "lucide-react";

export const QuoteItemLoadingStatus = ({ colSpan, position }: { colSpan: number; position: number }) => (
  <tr className="bg-amber-50">
    <td colSpan={colSpan} className="border-y border-amber-200 px-2 py-1.5">
      <div role="status" aria-live="polite" aria-atomic="true"
        className="sticky left-2 flex w-fit max-w-[calc(100vw-4rem)] items-center gap-2 text-xs font-semibold text-amber-900">
        <Loader2 aria-hidden="true" className="h-4 w-4 shrink-0 motion-safe:animate-spin" />
        <span>Creando producto local…<span className="sr-only"> para la partida {position}.</span></span>
      </div>
    </td>
  </tr>
);
