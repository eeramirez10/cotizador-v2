import { useManualQuoteStore } from "../../store/quote/manual-quote.store";

export const CustomerReferenceField = ({ compact }: { compact: boolean }) => {
  const reference = useManualQuoteStore(state => state.draft.customerReference);
  const detected = useManualQuoteStore(state => state.draft.detectedCustomerReference);
  const setReference = useManualQuoteStore(state => state.setCustomerReference);
  const useDetected = useManualQuoteStore(state => state.useDetectedCustomerReference);
  const conflicting = detected && detected !== reference;
  return (
    <div className={compact ? "lg:col-span-4" : "lg:col-span-2"}>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="customerReference" className={`font-semibold uppercase text-gray-500 ${compact ? "text-[9px]" : "text-xs"}`}>
          Referencia del cliente
        </label>
        {detected && <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">Detectada con IA</span>}
      </div>
      <input
        id="customerReference"
        value={reference}
        onChange={event => setReference(event.target.value)}
        maxLength={120}
        placeholder="Folio, proyecto o solicitud (opcional)"
        className={`mt-1 w-full rounded-md border border-gray-300 px-2 text-gray-700 ${compact ? "h-7 text-xs" : "py-1.5 text-sm"}`}
      />
      {conflicting && (
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          <span className="break-all text-gray-600">{detected}</span>
          <button type="button" onClick={useDetected} className="font-semibold text-blue-700 hover:underline">Usar referencia detectada</button>
        </div>
      )}
    </div>
  );
};
