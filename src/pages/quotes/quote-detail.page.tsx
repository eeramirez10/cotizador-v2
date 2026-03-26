import {
  CheckCircle2,
  CircleSlash,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Pencil,
  Printer,
  Send,
  ShoppingCart,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { CustomerContactsService } from "../../modules/clients/services/customer-contacts.service";
import type { CustomerContact } from "../../modules/clients/types/customer-contact.types";
import type { SavedQuoteRecord } from "../../modules/quotes/services/quotes.service";
import {
  useDownloadQuoteOrderFile,
  useGenerateQuoteOrder,
  useQuoteDetail,
  useRegisterQuoteDeliveryAttempt,
  useUpdateQuoteStatus,
} from "../../queries/quotes/use-quote-detail";
import { notifier } from "../../shared/notifications/notifier";

const statusClass: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  COTIZADA: "bg-emerald-100 text-emerald-700",
  APROBADA: "bg-blue-100 text-blue-700",
  RECHAZADA: "bg-orange-100 text-orange-700",
  CANCELADA: "bg-rose-100 text-rose-700",
};

const formatCurrency = (value: number, currency: "MXN" | "USD") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const getDisplayCost = (
  cost: number,
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD",
  exchangeRate: number
): number => {
  const safeRate = exchangeRate > 0 ? exchangeRate : 1;
  if (productCurrency === "USD") return cost / safeRate;
  if (quoteCurrency === "USD") return cost / safeRate;
  return cost;
};

const getDisplayCostCurrency = (
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD"
): "MXN" | "USD" => {
  if (productCurrency === "USD" || quoteCurrency === "USD") return "USD";
  return "MXN";
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
};

interface SendRecipientOption {
  id: string;
  name: string;
  label: string;
  email: string;
  whatsapp: string;
  isPrimary: boolean;
}

const normalizeEmail = (value: string): string => value.trim().toLowerCase();
const normalizePhone = (value: string): string => value.replace(/\D/g, "");

const createRecipientLabel = (name: string, companyName: string, whatsapp: string, email: string): string => {
  const safeName = name.trim() || companyName.trim() || "Contacto";
  const fragments: string[] = [];
  if (whatsapp.trim()) fragments.push(`WA: ${whatsapp.trim()}`);
  if (email.trim()) fragments.push(`Correo: ${email.trim()}`);
  return fragments.length > 0 ? `${safeName} (${fragments.join(" · ")})` : safeName;
};

const buildRecipientOptions = (
  client: SavedQuoteRecord["client"],
  contacts: CustomerContact[]
): SendRecipientOption[] => {
  const result: SendRecipientOption[] = [];
  const seen = new Set<string>();

  const addOption = (candidate: SendRecipientOption) => {
    const emailKey = normalizeEmail(candidate.email);
    const whatsappKey = normalizePhone(candidate.whatsapp);
    const dedupeKey = `${candidate.name.toLowerCase()}|${emailKey}|${whatsappKey}`;
    if (seen.has(dedupeKey)) return;
    seen.add(dedupeKey);
    result.push(candidate);
  };

  if (client) {
    const baseName = `${client.name || ""} ${client.lastname || ""}`.trim();
    addOption({
      id: "__base__",
      name: baseName || client.companyName || "Contacto ERP",
      label: createRecipientLabel(baseName, client.companyName || "", client.whatsappPhone || "", client.email || ""),
      email: client.email || "",
      whatsapp: client.whatsappPhone || "",
      isPrimary: true,
    });
  }

  contacts.forEach((contact) => {
    const contactWhatsapp = contact.mobile || contact.phone || "";
    const companyName = client?.companyName || "";
    addOption({
      id: contact.id,
      name: contact.name,
      label: createRecipientLabel(contact.name, companyName, contactWhatsapp, contact.email || ""),
      email: contact.email || "",
      whatsapp: contactWhatsapp,
      isPrimary: contact.isPrimary,
    });
  });

  return result;
};

const getDefaultRecipientId = (
  options: SendRecipientOption[],
  channel: "WHATSAPP" | "EMAIL"
): string => {
  const candidates =
    channel === "WHATSAPP"
      ? options.filter((option) => option.whatsapp.trim())
      : options.filter((option) => option.email.trim());
  if (candidates.length === 0) return "";
  return candidates.find((option) => option.isPrimary)?.id || candidates[0].id;
};

const waitForImages = async (root: HTMLElement): Promise<void> => {
  const images = Array.from(root.querySelectorAll("img"));
  if (images.length === 0) return;

  await Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete && image.naturalWidth > 0) {
            resolve();
            return;
          }

          const cleanup = () => {
            image.removeEventListener("load", onDone);
            image.removeEventListener("error", onDone);
          };

          const onDone = () => {
            cleanup();
            resolve();
          };

          image.addEventListener("load", onDone, { once: true });
          image.addEventListener("error", onDone, { once: true });
          window.setTimeout(onDone, 3000);
        })
    )
  );
};

const printableColorVars: CSSProperties = {
  "--color-white": "#ffffff",
  "--color-gray-50": "#f9fafb",
  "--color-gray-200": "#e5e7eb",
  "--color-gray-500": "#6b7280",
  "--color-gray-600": "#4b5563",
  "--color-gray-700": "#374151",
  "--color-gray-900": "#111827",
} as CSSProperties;

interface QuotePrintableDocumentProps {
  quote: SavedQuoteRecord;
  customerDisplayName: string;
  contactName: string;
  deliverySummary: string[];
  className?: string;
  style?: CSSProperties;
}

const QuotePrintableDocument = forwardRef<HTMLElement, QuotePrintableDocumentProps>(function QuotePrintableDocument(
  { quote, customerDisplayName, contactName, deliverySummary, className, style },
  ref
) {
  return (
    <article
      ref={ref}
      data-print-root
      className={className}
      style={{ width: "8.5in", minHeight: "11in", padding: "0.55in", ...printableColorVars, ...style }}
    >
      <header className="border-b border-gray-200 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img className="h-12" src="/img/logo-tuvansa.png" alt="Logo Tuvansa" loading="eager" />
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Cotización</p>
              <h1 className="text-2xl font-semibold">Propuesta Comercial</h1>
            </div>
          </div>

          <div className="space-y-1 text-right text-xs">
            <p>
              <span className="font-semibold">Folio:</span> {quote.quoteNumber || quote.quoteId}
            </p>
            <p>
              <span className="font-semibold">Fecha emisión:</span> {formatDate(quote.updatedAt || quote.createdAt)}
            </p>
            <p>
              <span className="font-semibold">Vigencia:</span> {quote.validityDays} dias naturales
            </p>
            <p>
              <span className="font-semibold">Moneda:</span> {quote.currency}
            </p>
          </div>
        </div>
      </header>

      <section className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Cliente</p>
          <p className="mt-1 font-semibold">{customerDisplayName}</p>
          <p className="text-xs text-gray-600">Contacto: {contactName || "-"}</p>
          <p className="text-xs text-gray-600">Correo: {quote.client?.email || "-"}</p>
          <p className="text-xs text-gray-600">WhatsApp: {quote.client?.whatsappPhone || "-"}</p>
        </div>

        <div className="rounded-md border border-gray-200 p-3">
          <p className="text-[11px] font-semibold uppercase text-gray-500">Datos comerciales</p>
          <p className="mt-1 text-xs text-gray-700">
            <span className="font-semibold">Vendedor:</span> {quote.createdByName || "-"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Sucursal:</span> {quote.branchName || "-"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Tipo de cambio:</span> {quote.exchangeRate}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Condicion de pago:</span> {quote.paymentTerms || "CONTADO"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Lugar de entrega:</span> {quote.deliveryPlace || "Por definir"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Tiempo de entrega:</span>{" "}
            {deliverySummary.length > 0 ? deliverySummary.join(" / ") : "Por definir"}
          </p>
        </div>
      </section>

      <section className="mt-4">
        <div className="overflow-hidden rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Código</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Descripción</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">UM</th>
                <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Cantidad</th>
                <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Precio unit.</th>
                <th className="px-2 py-2 text-right font-semibold uppercase text-gray-500">Importe</th>
                <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Entrega</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white text-[10px] leading-4">
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-2 py-2 align-top font-semibold">{item.erpCode || "-"}</td>
                  <td className="px-2 py-2 align-top">{item.erpDescription || item.customerDescription || "-"}</td>
                  <td className="px-2 py-2 align-top">{item.unit || "-"}</td>
                  <td className="px-2 py-2 text-right align-top">{item.qty}</td>
                  <td className="px-2 py-2 text-right align-top">{formatCurrency(item.unitPrice, quote.currency)}</td>
                  <td className="px-2 py-2 text-right align-top font-semibold">
                    {formatCurrency(item.subtotal, quote.currency)}
                  </td>
                  <td className="px-2 py-2 align-top">{item.deliveryTime || "Por definir"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-4 flex justify-end">
        <div className="w-full max-w-[300px] space-y-1 rounded-md border border-gray-200 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Subtotal</span>
            <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>IVA ({(quote.taxRate * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(quote.tax, quote.currency)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 font-semibold">
            <span>Total</span>
            <span>{formatCurrency(quote.total, quote.currency)}</span>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-md border border-gray-200 p-3">
        <p className="text-[11px] font-semibold uppercase text-gray-500">Condiciones comerciales</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4 text-[10px] leading-4 text-gray-700">
          <li>PRECIOS: UNITARIOS MAS IVA.</li>
          <li>COTIZACION: DOLARES PAGADEROS AL TIPO DE CAMBIO DEL DIARIO OFICIAL EL DIA DE LA OPERACION.</li>
          <li>CONDICIONES DE PAGO: {(quote.paymentTerms || "CONTADO").toUpperCase()}.</li>
          <li>LUGAR DE ENTREGA: {(quote.deliveryPlace || "POR DEFINIR").toUpperCase()}.</li>
          <li>TIEMPO DE ENTREGA: EL MARCADO POR PARTIDA.</li>
          <li>
            EN CASO DE ACEPTACION, SU O.C. DEBE VENIR DEBIDAMENTE FIRMADA POR EL JEFE DE COMPRAS Y/O REPRESENTANTE DE
            LA EMPRESA.
          </li>
          <li>MATERIALES COTIZADOS SUJETOS A PREVIA VENTA.</li>
          <li>PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO.</li>
          <li>NO SE ACEPTAN DEVOLUCIONES.</li>
          <li>VIGENCIA {quote.validityDays} DIAS.</li>
        </ol>
      </section>

      <footer className="mt-6 border-t border-gray-200 pt-3 text-[11px] text-gray-500">
        <div className="flex items-center justify-between">
          <p>Esta es una vista previa del diseño PDF de cotización.</p>
          <p>Página 1/1</p>
        </div>
      </footer>
    </article>
  );
});

export const QuoteDetailPage = () => {
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [showCustomerOrderColumns, setShowCustomerOrderColumns] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendChannel, setSendChannel] = useState<"WHATSAPP" | "EMAIL" | "BOTH">("BOTH");
  const [sendRecipientOptions, setSendRecipientOptions] = useState<SendRecipientOption[]>([]);
  const [selectedWhatsAppRecipientId, setSelectedWhatsAppRecipientId] = useState("");
  const [selectedEmailRecipientId, setSelectedEmailRecipientId] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState("");
  const [orderGeneratedLocal, setOrderGeneratedLocal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const printableRef = useRef<HTMLElement | null>(null);

  const { data: quote, isLoading, refetch } = useQuoteDetail(quoteId);
  const updateStatus = useUpdateQuoteStatus();
  const generateOrder = useGenerateQuoteOrder();
  const downloadOrderFile = useDownloadQuoteOrderFile();
  const registerDeliveryAttempt = useRegisterQuoteDeliveryAttempt();

  const isActionLocked =
    actionInProgress ||
    updateStatus.isPending ||
    generateOrder.isPending ||
    downloadOrderFile.isPending ||
    registerDeliveryAttempt.isPending;
  const disabledActionClass = "disabled:cursor-not-allowed disabled:opacity-60";
  const availableWhatsAppRecipients = useMemo(
    () => sendRecipientOptions.filter((option) => option.whatsapp.trim()),
    [sendRecipientOptions]
  );
  const availableEmailRecipients = useMemo(
    () => sendRecipientOptions.filter((option) => option.email.trim()),
    [sendRecipientOptions]
  );
  const selectedWhatsAppRecipient = useMemo(
    () => sendRecipientOptions.find((option) => option.id === selectedWhatsAppRecipientId) || null,
    [sendRecipientOptions, selectedWhatsAppRecipientId]
  );
  const selectedEmailRecipient = useMemo(
    () => sendRecipientOptions.find((option) => option.id === selectedEmailRecipientId) || null,
    [sendRecipientOptions, selectedEmailRecipientId]
  );

  useEffect(() => {
    if (!showSendModal) return;

    let cancelled = false;

    const loadRecipients = async () => {
      setLoadingRecipients(true);
      setRecipientsError("");

      try {
        const customerId = quote?.client?.id;
        const contacts = customerId ? await CustomerContactsService.list(customerId) : [];
        const options = buildRecipientOptions(quote?.client ?? null, contacts);
        if (cancelled) return;

        setSendRecipientOptions(options);
        setSelectedWhatsAppRecipientId(getDefaultRecipientId(options, "WHATSAPP"));
        setSelectedEmailRecipientId(getDefaultRecipientId(options, "EMAIL"));
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "No se pudieron cargar los contactos.";
        setRecipientsError(message);
        const options = buildRecipientOptions(quote?.client ?? null, []);
        setSendRecipientOptions(options);
        setSelectedWhatsAppRecipientId(getDefaultRecipientId(options, "WHATSAPP"));
        setSelectedEmailRecipientId(getDefaultRecipientId(options, "EMAIL"));
      } finally {
        if (!cancelled) {
          setLoadingRecipients(false);
        }
      }
    };

    void loadRecipients();

    return () => {
      cancelled = true;
    };
  }, [
    showSendModal,
    quote?.client?.id,
    quote?.client?.name,
    quote?.client?.lastname,
    quote?.client?.companyName,
    quote?.client?.email,
    quote?.client?.whatsappPhone,
  ]);

  if (isLoading) {
    return <p className="text-sm text-gray-500">Cargando detalle de cotización...</p>;
  }

  if (!quote) {
    return (
      <div className="rounded-md border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-600">No se encontró la cotización.</p>
        <NavLink to="/quotes" className="mt-3 inline-block text-sm font-semibold text-blue-600 hover:text-blue-800">
          Volver a cotizaciones
        </NavLink>
      </div>
    );
  }

  const badgeClass = statusClass[quote.status] ?? "bg-gray-100 text-gray-700";
  const showCustomerExtractionColumns = quote.items.some(
    (item) => (item.customerDescription || "").trim().length > 0 || (item.customerUnit || "").trim().length > 0
  );
  const company = quote.client?.companyName?.trim() || "";
  const contactName = `${quote.client?.name || ""} ${quote.client?.lastname || ""}`.trim();
  const customerDisplayName = company || contactName || "Cliente sin nombre";
  const deliverySummary = Array.from(
    new Set(quote.items.map((item) => (item.deliveryTime || "").trim()).filter(Boolean))
  );
  const canMarkQuoted = quote.status === "BORRADOR" || quote.status === "PENDIENTE";
  const canEditQuote = quote.status !== "CANCELADA";
  const canSendQuote = quote.status === "COTIZADA" || quote.status === "APROBADA" || quote.status === "RECHAZADA";
  const canDownloadQuotePdf =
    quote.status === "COTIZADA" || quote.status === "APROBADA" || quote.status === "RECHAZADA";
  const canApproveReject = quote.status === "COTIZADA";
  const canGenerateOrder = quote.status === "APROBADA" && quote.orderStatus !== "GENERADO";
  const canDownloadOrder =
    quote.status === "APROBADA" || quote.orderStatus === "GENERADO" || orderGeneratedLocal;

  const runActionWithToast = async <T,>({
    loadingMessage,
    action,
    isSuccess,
    successMessage,
    errorMessage,
    onSuccess,
  }: {
    loadingMessage: string;
    action: () => Promise<T>;
    isSuccess?: (result: T) => boolean;
    successMessage?: string | ((result: T) => string);
    errorMessage?: string | ((result: T) => string);
    onSuccess?: (result: T) => Promise<void> | void;
  }) => {
    if (isActionLocked) return;

    setActionInProgress(true);
    const loadingToastId = notifier.loading(loadingMessage);

    try {
      const result = await action();
      const successful = isSuccess ? isSuccess(result) : true;

      if (!successful) {
        const resolvedError =
          typeof errorMessage === "function"
            ? errorMessage(result)
            : errorMessage || "No se pudo completar la operación.";

        if (loadingToastId !== undefined) {
          notifier.update(loadingToastId, "error", resolvedError);
        } else {
          notifier.error(resolvedError);
        }
        return;
      }

      const resolvedSuccess = typeof successMessage === "function" ? successMessage(result) : successMessage;
      if (resolvedSuccess) {
        if (loadingToastId !== undefined) {
          notifier.update(loadingToastId, "success", resolvedSuccess);
        } else {
          notifier.success(resolvedSuccess);
        }
      } else if (loadingToastId !== undefined) {
        notifier.dismiss(loadingToastId);
      }

      await onSuccess?.(result);
    } catch (error) {
      const resolvedError =
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo completar la operación.";

      if (loadingToastId !== undefined) {
        notifier.update(loadingToastId, "error", resolvedError);
      } else {
        notifier.error(resolvedError);
      }
    } finally {
      setActionInProgress(false);
    }
  };

  const handleCancelQuote = async () => {
    if (isActionLocked) return;
    const confirmCancel = window.confirm("¿Seguro que quieres cancelar esta cotización?");
    if (!confirmCancel) return;

    await runActionWithToast({
      loadingMessage: "Cancelando cotización...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "CANCELADA" }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización cancelada.",
      errorMessage: "No se pudo cancelar la cotización.",
      onSuccess: async () => {
        await refetch();
      },
    });
  };

  const handleMarkQuoted = async () => {
    await runActionWithToast({
      loadingMessage: "Actualizando estatus a COTIZADA...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "COTIZADA" }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Estatus actualizado a COTIZADA.",
      errorMessage: "No se pudo actualizar el estatus.",
      onSuccess: async () => {
        await refetch();
      },
    });
  };

  const handleApproveQuote = async () => {
    await runActionWithToast({
      loadingMessage: "Marcando cotización como APROBADA...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "APROBADA" }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización marcada como APROBADA.",
      errorMessage: "No se pudo marcar la cotización como APROBADA.",
      onSuccess: async () => {
        await refetch();
      },
    });
  };

  const handleRejectQuote = async () => {
    await runActionWithToast({
      loadingMessage: "Marcando cotización como RECHAZADA...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "RECHAZADA" }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización marcada como RECHAZADA.",
      errorMessage: "No se pudo marcar la cotización como RECHAZADA.",
      onSuccess: async () => {
        await refetch();
      },
    });
  };

  const buildWhatsAppUrl = (recipient: string): string => {
    const digits = recipient.replace(/\D/g, "");
    const message = `Hola, comparto la cotización ${quote.quoteNumber || quote.quoteId}.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  const buildMailToUrl = (recipient: string): string => {
    const email = recipient || "";
    const subject = `Cotización ${quote.quoteNumber || quote.quoteId}`;
    const body = `Hola,\n\nTe comparto la cotización ${quote.quoteNumber || quote.quoteId}.\n\nSaludos.`;
    return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSendQuote = async () => {
    await runActionWithToast({
      loadingMessage: "Registrando envío de cotización...",
      action: async () => {
        const channels =
          sendChannel === "BOTH" ? (["WHATSAPP", "EMAIL"] as const) : ([sendChannel] as const);

        const results: boolean[] = [];

        for (const channel of channels) {
          const recipient =
            channel === "WHATSAPP"
              ? selectedWhatsAppRecipient?.whatsapp || ""
              : selectedEmailRecipient?.email || "";
          if (!recipient.trim()) {
            notifier.warning(
              channel === "WHATSAPP"
                ? "Selecciona un contacto con WhatsApp para enviar."
                : "Selecciona un contacto con correo para enviar."
            );
            results.push(false);
            continue;
          }

          const url = channel === "WHATSAPP" ? buildWhatsAppUrl(recipient) : buildMailToUrl(recipient);
          window.open(url, "_blank", "noopener,noreferrer");

          const response = await registerDeliveryAttempt.mutateAsync({
            quoteId: quote.quoteId,
            channel,
            recipient,
            note:
              channel === "WHATSAPP"
                ? "Quote sent manually via WhatsApp from frontend."
                : "Quote sent manually via email from frontend.",
          });

          results.push(response.ok);
          if (!response.ok) {
            notifier.error(response.message);
          }
        }

        return { anySuccess: results.some(Boolean) };
      },
      isSuccess: (result) => result.anySuccess,
      successMessage: "Envío registrado correctamente.",
      errorMessage: "No se pudo registrar el envío.",
      onSuccess: async () => {
        setShowSendModal(false);
        await refetch();
      },
    });
  };

  const handleGenerateOrder = async () => {
    await runActionWithToast({
      loadingMessage: "Generando pedido...",
      action: () => generateOrder.mutateAsync({ quoteId: quote.quoteId }),
      isSuccess: (result) => result.ok,
      successMessage: (result) => result.message,
      errorMessage: (result) => result.message,
      onSuccess: async () => {
        setOrderGeneratedLocal(true);
        const downloadResult = await downloadOrderFile.mutateAsync({ quoteId: quote.quoteId });
        if (downloadResult.ok) {
          notifier.info("Archivo .txt descargado. Pégalo en la carpeta del servidor FTP.");
        } else {
          notifier.warning("Pedido generado, pero no se pudo descargar automáticamente.");
        }
        await refetch();
      },
    });
  };

  const handleDownloadOrderFile = async () => {
    await runActionWithToast({
      loadingMessage: "Descargando pedido...",
      action: () => downloadOrderFile.mutateAsync({ quoteId: quote.quoteId }),
      isSuccess: (result) => result.ok,
      successMessage: (result) => result.message,
      errorMessage: (result) => result.message,
    });
  };

  const handleDownloadQuotePdf = async () => {
    await runActionWithToast({
      loadingMessage: "Generando PDF de cotización...",
      action: async () => {
        const printable = printableRef.current;
        if (!printable) {
          throw new Error("No se pudo preparar la cotización para descargar.");
        }

        const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);

        if ("fonts" in document) {
          await document.fonts.ready;
        }
        await waitForImages(printable);

        const rootRect = printable.getBoundingClientRect();
        const rowBreaksDom = Array.from(printable.querySelectorAll("tbody tr"))
          .map((row) => (row as HTMLElement).getBoundingClientRect().top - rootRect.top)
          .filter((top) => Number.isFinite(top) && top > 0)
          .sort((a, b) => a - b);

        const canvas = await html2canvas(printable, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          windowWidth: printable.scrollWidth,
          windowHeight: printable.scrollHeight,
        });

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "pt",
          format: "letter",
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const marginTop = 26;
        const marginBottom = 20;
        const marginX = 18;
        const contentWidth = pageWidth - marginX * 2;
        const contentHeight = pdf.internal.pageSize.getHeight() - marginTop - marginBottom;
        const imageHeight = (canvas.height * contentWidth) / canvas.width;
        const domToPdfFactor = imageHeight / Math.max(printable.scrollHeight, 1);
        const rowBreaksPdf = rowBreaksDom.map((value) => value * domToPdfFactor);
        const pxPerPdfUnit = canvas.height / Math.max(imageHeight, 1);

        let currentOffset = 0;
        const minChunkHeight = 130;
        let pageIndex = 0;

        while (currentOffset < imageHeight - 0.5) {
          const tentativeEnd = Math.min(currentOffset + contentHeight, imageHeight);
          const candidates = rowBreaksPdf.filter(
            (value) => value > currentOffset + minChunkHeight && value <= tentativeEnd - 4
          );
          const nextOffset = candidates.length > 0 ? candidates[candidates.length - 1] : tentativeEnd;
          const safeNextOffset = nextOffset > currentOffset + 4 ? nextOffset : tentativeEnd;
          const chunkHeightPdf = safeNextOffset - currentOffset;
          if (chunkHeightPdf <= 0) {
            break;
          }

          if (pageIndex > 0) {
            pdf.addPage("letter", "portrait");
          }

          const sourceY = Math.floor(currentOffset * pxPerPdfUnit);
          const sourceHeight = Math.max(1, Math.ceil(chunkHeightPdf * pxPerPdfUnit));
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = canvas.width;
          pageCanvas.height = sourceHeight;
          const pageContext = pageCanvas.getContext("2d");
          if (!pageContext) {
            throw new Error("No se pudo preparar el contexto de imagen para PDF.");
          }

          pageContext.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
          const pageImageData = pageCanvas.toDataURL("image/jpeg", 0.96);
          const renderedHeight = sourceHeight / pxPerPdfUnit;
          pdf.addImage(pageImageData, "JPEG", marginX, marginTop, contentWidth, renderedHeight, undefined, "FAST");

          currentOffset = safeNextOffset;
          pageIndex += 1;
        }

        const safeFileName = `${quote.quoteNumber || quote.quoteId}`
          .replace(/[^a-zA-Z0-9_-]/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");

        pdf.save(`${safeFileName || "cotizacion"}.pdf`);
        return true;
      },
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización descargada en PDF.",
      errorMessage: "No se pudo descargar la cotización.",
    });
  };

  const handlePrintPreview = async () => {
    const printable = printableRef.current;
    if (!printable) return;

    const host = document.createElement("div");
    host.id = "quote-print-host";

    const cloned = printable.cloneNode(true) as HTMLElement;
    cloned.setAttribute("data-print-root", "");
    host.appendChild(cloned);
    document.body.appendChild(host);
    document.body.classList.add("printing-quote");
    await waitForImages(cloned);

    const cleanup = () => {
      document.body.classList.remove("printing-quote");
      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }
      window.removeEventListener("afterprint", cleanup);
    };

    window.addEventListener("afterprint", cleanup);
    window.setTimeout(() => {
      window.print();
      window.setTimeout(cleanup, 1000);
    }, 80);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Cotización #{quote.quoteId.replace("COT-", "")}</h2>
          <p className="text-xs text-gray-500">Creada: {new Date(quote.createdAt).toLocaleString("es-MX")}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>{quote.status}</span>

          <button
            onClick={() => navigate(`/quotes/manual?quoteId=${quote.quoteId}`)}
            disabled={isActionLocked || !canEditQuote}
            title={!canEditQuote ? "No puedes editar una cotización cancelada." : undefined}
            className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>

          <button
            onClick={() => setShowPdfPreview(true)}
            disabled={isActionLocked}
            className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
          >
            <FileText className="h-4 w-4" />
            Vista PDF
          </button>

          {canDownloadQuotePdf && (
            <button
              onClick={handleDownloadQuotePdf}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Download className="h-4 w-4" />
              Descargar cotización (PDF)
            </button>
          )}

          {canSendQuote && (
            <button
              onClick={() => setShowSendModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          )}

          {canGenerateOrder && (
            <button
              onClick={handleGenerateOrder}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <ShoppingCart className="h-4 w-4" />
              Generar pedido (.txt)
            </button>
          )}

          {canDownloadOrder && (
            <button
              onClick={handleDownloadOrderFile}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Download className="h-4 w-4" />
              {isActionLocked ? "Procesando..." : "Descargar pedido"}
            </button>
          )}

          {canMarkQuoted && (
            <button
              onClick={handleMarkQuoted}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 ${disabledActionClass}`}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar cotizada
            </button>
          )}

          {canApproveReject && (
            <button
              onClick={handleApproveQuote}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 ${disabledActionClass}`}
            >
              <ThumbsUp className="h-4 w-4" />
              Marcar aprobada
            </button>
          )}

          {canApproveReject && (
            <button
              onClick={handleRejectQuote}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 ${disabledActionClass}`}
            >
              <ThumbsDown className="h-4 w-4" />
              Marcar rechazada
            </button>
          )}

          {quote.status !== "CANCELADA" && (
            <button
              onClick={handleCancelQuote}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 ${disabledActionClass}`}
            >
              <CircleSlash className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vendedor</p>
          <p className="text-sm text-gray-700">{quote.createdByName || "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Sucursal</p>
          <p className="text-sm text-gray-700">{quote.branchName || "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Moneda</p>
          <p className="text-sm text-gray-700">{quote.currency}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Tipo de cambio</p>
          <p className="text-sm text-gray-700">{quote.exchangeRate}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Cliente</p>
          <p className="text-sm text-gray-700">
            {quote.client ? quote.client.companyName || `${quote.client.name} ${quote.client.lastname}`.trim() : "-"}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">WhatsApp</p>
          <p className="text-sm text-gray-700">{quote.client?.whatsappPhone ?? "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Envío cliente</p>
          <p className="text-sm text-gray-700">
            {quote.deliveryStatus}
            {quote.firstSentAt ? ` · ${new Date(quote.firstSentAt).toLocaleString("es-MX")}` : ""}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Pedido ERP</p>
          <p className="text-sm text-gray-700">
            {quote.orderStatus}
            {quote.orderReference ? ` · ${quote.orderReference}` : ""}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Condiciones de pago</p>
          <p className="text-sm text-gray-700">{quote.paymentTerms || "CONTADO"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vigencia</p>
          <p className="text-sm text-gray-700">
            {quote.validityDays} dias
            {quote.validUntil ? ` · vence ${formatDate(quote.validUntil)}` : ""}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Lugar de entrega</p>
          <p className="text-sm text-gray-700">{quote.deliveryPlace || "Por definir"}</p>
        </div>
      </div>

      <div className="max-h-[62vh] overflow-x-auto overflow-y-auto rounded-md border border-gray-200 bg-white">
        {showCustomerExtractionColumns && (
          <div className="flex justify-end border-b border-gray-200 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowCustomerOrderColumns((prev) => !prev)}
              disabled={isActionLocked}
              className={`rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              {showCustomerOrderColumns ? "Ocultar pedido cliente" : "Mostrar pedido cliente"}
            </button>
          </div>
        )}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Código ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">EAN</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Origen</th>
              {showCustomerExtractionColumns && showCustomerOrderColumns && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción cliente</th>
              )}
              {showCustomerExtractionColumns && showCustomerOrderColumns && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM cliente</th>
              )}
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Descripción ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">UM</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Stock</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Entrega</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Cantidad</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Costo ERP</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Margen</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Precio</th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Subtotal</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {quote.items.map((item) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-xs font-semibold text-gray-700">{item.erpCode || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.ean || "-"}</td>
                <td className="px-3 py-2">
                  {item.erpCode ? (
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-[10px] font-semibold text-sky-700">ERP</span>
                  ) : item.localProductId ? (
                    <span className="rounded-full bg-violet-100 px-2 py-1 text-[10px] font-semibold text-violet-700">LOCAL_TEMP</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">SIN VINCULAR</span>
                  )}
                </td>
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">{item.customerDescription || "-"}</td>
                )}
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">{item.customerUnit || "-"}</td>
                )}
                <td className="px-3 py-2 text-xs text-gray-700">{item.erpDescription || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.unit || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.stock}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.deliveryTime}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.qty}</td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {formatCurrency(
                    getDisplayCost(item.costUsd, item.costCurrency || "USD", quote.currency, quote.exchangeRate),
                    getDisplayCostCurrency(item.costCurrency || "USD", quote.currency)
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.marginPct}%</td>
                <td className="px-3 py-2 text-xs text-gray-700">{formatCurrency(item.unitPrice, quote.currency)}</td>
                <td className="px-3 py-2 text-xs font-semibold text-emerald-700">{formatCurrency(item.subtotal, quote.currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-sm rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Subtotal</span>
            <span>{formatCurrency(quote.subtotal, quote.currency)}</span>
          </div>

          <div className="mt-1 flex items-center justify-between text-sm text-gray-700">
            <span>IVA ({(quote.taxRate * 100).toFixed(0)}%)</span>
            <span>{formatCurrency(quote.tax, quote.currency)}</span>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-base font-semibold text-gray-900">
            <span>Total</span>
            <span>{formatCurrency(quote.total, quote.currency)}</span>
          </div>
        </div>
      </div>

      {showSendModal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => {
              if (!isActionLocked) setShowSendModal(false);
            }}
            disabled={isActionLocked}
            className={`absolute inset-0 bg-black/40 ${disabledActionClass}`}
            aria-label="Cerrar modal de envío"
          />

          <div className="relative w-full max-w-lg rounded-md border border-gray-200 bg-white p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Enviar cotización</h3>
                <p className="text-xs text-gray-500">
                  Selecciona el canal. Se registrará el envío automáticamente en la cotización.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                disabled={isActionLocked}
                className={`rounded-md p-1 text-gray-500 hover:bg-gray-100 ${disabledActionClass}`}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setSendChannel("WHATSAPP")}
                disabled={isActionLocked}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  sendChannel === "WHATSAPP"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                } ${disabledActionClass}`}
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </button>

              <button
                type="button"
                onClick={() => setSendChannel("EMAIL")}
                disabled={isActionLocked}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  sendChannel === "EMAIL"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                } ${disabledActionClass}`}
              >
                <Mail className="h-4 w-4" />
                Correo
              </button>

              <button
                type="button"
                onClick={() => setSendChannel("BOTH")}
                disabled={isActionLocked}
                className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                  sendChannel === "BOTH"
                    ? "border-violet-500 bg-violet-50 text-violet-700"
                    : "border-gray-300 text-gray-700 hover:bg-gray-50"
                } ${disabledActionClass}`}
              >
                <Send className="h-4 w-4" />
                Ambos
              </button>
            </div>

            <div className="mt-4 rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
              {loadingRecipients ? (
                <p>Cargando contactos...</p>
              ) : (
                <>
                  {(sendChannel === "WHATSAPP" || sendChannel === "BOTH") && (
                    <div className="mb-3">
                      <p className="mb-1 font-semibold text-gray-700">Contacto WhatsApp</p>
                      <select
                        value={selectedWhatsAppRecipientId}
                        onChange={(event) => setSelectedWhatsAppRecipientId(event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700"
                      >
                        <option value="">Selecciona contacto...</option>
                        {availableWhatsAppRecipients.map((option) => (
                          <option key={`wa-${option.id}`} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {!availableWhatsAppRecipients.length && (
                        <p className="mt-1 text-[11px] text-amber-600">No hay contactos con WhatsApp disponible.</p>
                      )}
                    </div>
                  )}

                  {(sendChannel === "EMAIL" || sendChannel === "BOTH") && (
                    <div className="mb-3">
                      <p className="mb-1 font-semibold text-gray-700">Contacto correo</p>
                      <select
                        value={selectedEmailRecipientId}
                        onChange={(event) => setSelectedEmailRecipientId(event.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-xs text-gray-700"
                      >
                        <option value="">Selecciona contacto...</option>
                        {availableEmailRecipients.map((option) => (
                          <option key={`mail-${option.id}`} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {!availableEmailRecipients.length && (
                        <p className="mt-1 text-[11px] text-amber-600">No hay contactos con correo disponible.</p>
                      )}
                    </div>
                  )}

                  {recipientsError && <p className="text-[11px] text-rose-600">{recipientsError}</p>}

                  <p>
                    <span className="font-semibold">WhatsApp seleccionado:</span>{" "}
                    {selectedWhatsAppRecipient?.whatsapp || "No seleccionado"}
                  </p>
                  <p>
                    <span className="font-semibold">Correo seleccionado:</span>{" "}
                    {selectedEmailRecipient?.email || "No seleccionado"}
                  </p>
                </>
              )}
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowSendModal(false)}
                disabled={isActionLocked}
                className={`rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSendQuote}
                disabled={isActionLocked}
                className={`rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 ${disabledActionClass}`}
              >
                {isActionLocked ? "Procesando..." : "Confirmar envío"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPdfPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => {
              if (!isActionLocked) setShowPdfPreview(false);
            }}
            disabled={isActionLocked}
            className={`absolute inset-0 bg-black/40 ${disabledActionClass}`}
            aria-label="Cerrar vista previa PDF"
          />

          <div className="relative max-h-[92vh] w-full max-w-[95vw] overflow-auto rounded-md border border-gray-200 bg-slate-100 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Vista previa PDF</h3>
                <p className="text-xs text-gray-500">Diseño carta antes de generar y enviar al cliente.</p>
              </div>
              <div className="flex items-center gap-2">
                {canDownloadQuotePdf && (
                  <button
                    type="button"
                    onClick={handleDownloadQuotePdf}
                    disabled={isActionLocked}
                    className={`inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
                  >
                    <Download className="h-4 w-4" />
                    Descargar PDF
                  </button>
                )}
                <button
                  type="button"
                  onClick={handlePrintPreview}
                  disabled={isActionLocked}
                  className={`inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
                >
                  <Printer className="h-4 w-4" />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => setShowPdfPreview(false)}
                  disabled={isActionLocked}
                  className={`rounded-md p-1 text-gray-500 hover:bg-gray-200 ${disabledActionClass}`}
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <QuotePrintableDocument
              quote={quote}
              customerDisplayName={customerDisplayName}
              contactName={contactName}
              deliverySummary={deliverySummary}
              className="mx-auto bg-white text-gray-900 shadow-lg"
            />
          </div>
        </div>
      )}

      <div aria-hidden className="pointer-events-none fixed left-0 top-[120vh] -z-10">
        <QuotePrintableDocument
          ref={printableRef}
          quote={quote}
          customerDisplayName={customerDisplayName}
          contactName={contactName}
          deliverySummary={deliverySummary}
          className="bg-white text-gray-900"
        />
      </div>
    </section>
  );
};
