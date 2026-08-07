import {
  Archive,
  ArchiveRestore,
  BadgeCheck,
  CheckCircle2,
  CircleSlash,
  Download,
  FileText,
  Mail,
  MessageCircle,
  Paperclip,
  Palette,
  Pencil,
  Printer,
  RefreshCw,
  Send,
  ShieldCheck,
  ShoppingCart,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { NavLink, useNavigate, useParams } from "react-router";
import { CustomerContactsService } from "../../modules/clients/services/customer-contacts.service";
import type { CustomerContact } from "../../modules/clients/types/customer-contact.types";
import type {
  QuoteCancellationReason,
  QuoteRejectionReason,
  QuoteRevisionReason,
  SavedQuoteRecord,
} from "../../modules/quotes/services/quotes.service";
import {
  useDownloadQuoteOrderFile,
  useGenerateQuoteOrder,
  useCreateQuoteRevision,
  useArchiveQuote,
  useRestoreQuote,
  useDeleteQuotePermanently,
  useQuoteDetail,
  useRegisterQuoteDeliveryAttempt,
  useRegisterErpQuote,
  useUpdateQuoteStatus,
} from "../../queries/quotes/use-quote-detail";
import { notifier } from "../../shared/notifications/notifier";
import { useQuoteCatalogs } from "../../queries/quote-catalogs/use-quote-catalogs";
import { useAuthStore } from "../../store/auth/auth.store";
import { getErpCostDisplayAmount, getErpCostDisplayCurrency } from "../../modules/quotes/utils/quote-currency";
import { useQuotePurchaseRequisition } from "../../queries/procurement/use-purchase-requisitions";
import { useSystemCapabilities } from "../../queries/system/use-system-capabilities";
import { useQuoteAttachments } from "../../queries/attachments/use-attachments";
import { AttachmentsModal } from "../../shared/components/attachments/attachments.modal";
import { AttachmentsService, type FileAttachment } from "../../modules/attachments/services/attachments.service";

const statusClass: Record<string, string> = {
  BORRADOR: "bg-slate-100 text-slate-700",
  PENDIENTE: "bg-amber-100 text-amber-700",
  PENDIENTE_APROBACION: "bg-cyan-100 text-cyan-700",
  CAMBIOS_SOLICITADOS: "bg-amber-100 text-amber-800",
  COTIZADA: "bg-emerald-100 text-emerald-700",
  APROBADA: "bg-blue-100 text-blue-700",
  RECHAZADA: "bg-orange-100 text-orange-700",
  CANCELADA: "bg-rose-100 text-rose-700",
  REEMPLAZADA: "bg-gray-200 text-gray-700",
};

const REVISION_REASON_OPTIONS: Array<{ value: QuoteRevisionReason; label: string }> = [
  { value: "CUSTOMER_REQUEST", label: "Solicitud del cliente" },
  { value: "ADD_REMOVE_ITEMS", label: "Agregar o eliminar partidas" },
  { value: "PRICE_OR_QUANTITY_CHANGE", label: "Cambiar precio o cantidad" },
  { value: "EXCHANGE_RATE_CHANGE", label: "Actualizar o corregir tipo de cambio" },
  { value: "INFORMATION_CORRECTION", label: "Corregir información" },
  { value: "COMMERCIAL_TERMS", label: "Cambiar condiciones comerciales" },
  { value: "OTHER", label: "Otro" },
];

const revisionReasonLabel = (reason: QuoteRevisionReason | null): string =>
  REVISION_REASON_OPTIONS.find((option) => option.value === reason)?.label || reason || "Sin especificar";

const sourceChannelLabel: Record<SavedQuoteRecord["sourceChannel"], string> = {
  UNSPECIFIED: "Sin especificar",
  EMAIL: "Correo",
  PHONE: "Teléfono",
  WHATSAPP: "WhatsApp",
  AI_ASSISTANT: "Asistente IA",
  IN_PERSON: "Presencial",
  OTHER: "Otro",
};

const REJECTION_REASON_OPTIONS: Array<{ value: QuoteRejectionReason; label: string }> = [
  { value: "PRICE_HIGH", label: "Precio elevado" },
  { value: "COST_HIGH", label: "Costo elevado" },
  { value: "MATERIAL_UNAVAILABLE", label: "Falta de material" },
  { value: "DELIVERY_TIME", label: "Tiempo de entrega" },
  { value: "COMPETITOR_SELECTED", label: "Cotizó con otro proveedor" },
  { value: "COMMERCIAL_TERMS", label: "Condiciones comerciales" },
  { value: "SPECIFICATION_MISMATCH", label: "Especificación no cumple" },
  { value: "LATE_QUOTATION", label: "Se tardó en cotizar" },
  { value: "PROJECT_CANCELLED", label: "Proyecto cancelado o pospuesto" },
  { value: "NO_CUSTOMER_RESPONSE", label: "Sin respuesta del cliente" },
  { value: "DUPLICATE_OR_ERROR", label: "Solicitud duplicada o error" },
  { value: "OTHER", label: "Otro" },
];

const rejectionReasonLabel = (reason: QuoteRejectionReason | null): string =>
  REJECTION_REASON_OPTIONS.find((option) => option.value === reason)?.label || "Sin especificar";

const CANCELLATION_REASON_OPTIONS: Array<{ value: QuoteCancellationReason; label: string }> = [
  { value: "DATA_ENTRY_ERROR", label: "Error de captura" },
  { value: "DUPLICATE_REQUEST", label: "Cotización duplicada" },
  { value: "INSUFFICIENT_INFORMATION", label: "Información insuficiente" },
  { value: "INCORRECT_ITEMS", label: "Partidas incorrectas" },
  { value: "REPLACED_BY_REVISION", label: "Se sustituyó por una revisión" },
  { value: "OUT_OF_SCOPE", label: "Solicitud fuera de alcance" },
  { value: "ADMINISTRATIVE", label: "Cancelación administrativa" },
  { value: "OTHER", label: "Otro" },
];

const cancellationReasonLabel = (reason: QuoteCancellationReason | null): string =>
  CANCELLATION_REASON_OPTIONS.find((option) => option.value === reason)?.label || "Sin especificar";

const catalogReasonLabel = (
  reason: string | null,
  options: Array<{ value: string; label: string }>,
  fallback: (reason: string | null) => string
): string => reason ? options.find((option) => option.value === reason)?.label || fallback(reason) : "Sin especificar";

const formatCurrency = (value: number, currency: "MXN" | "USD") => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
};

const formatLineAmount = (value: number) => {
  return `$${new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)}`;
};

const getBranchAddressLines = (branch: SavedQuoteRecord["branch"]): string[] => {
  const streetLine = [
    branch.street,
    branch.exteriorNumber && `#${branch.exteriorNumber}`,
    branch.interiorNumber && `Int. ${branch.interiorNumber}`,
  ].filter(Boolean).join(" ");
  const locationLine = [
    branch.neighborhood && `Col. ${branch.neighborhood}`,
    branch.municipality,
    branch.city,
    branch.state,
    branch.postalCode && `C.P. ${branch.postalCode}`,
  ].filter(Boolean).join(", ");
  const hasAddress = Boolean(streetLine || locationLine || branch.postalCode);
  const locationWithCountry = hasAddress ? [locationLine, branch.country].filter(Boolean).join(", ") : "";

  return [streetLine, locationWithCountry].filter(Boolean);
};

const formatPhoneNumber = (value: string | null | undefined): string => {
  const raw = value?.trim() || "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)} ${digits.slice(6)}`;
  if (digits.length === 12 && digits.startsWith("52")) return `+52 (${digits.slice(2, 4)}) ${digits.slice(4, 8)} ${digits.slice(8)}`;
  return raw;
};

const formatBranchPhones = (branch: SavedQuoteRecord["branch"]): string =>
  [branch.phone, branch.secondaryPhone].filter(Boolean).map(formatPhoneNumber).join(" · ");

const getCommercialConditions = (quote: SavedQuoteRecord): string[] => {
  const configured = (quote.commercialConditions || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const fallback = ["PRECIOS: UNITARIOS MAS IVA.", "COTIZACION: DOLARES PAGADEROS AL TIPO DE CAMBIO DEL DIARIO OFICIAL EL DIA DE LA OPERACION.", "TIEMPO DE ENTREGA: EL MARCADO POR PARTIDA.", "MATERIALES COTIZADOS SUJETOS A PREVIA VENTA.", "PRECIOS SUJETOS A CAMBIO SIN PREVIO AVISO.", "NO SE ACEPTAN DEVOLUCIONES."];
  return [`CONDICIONES DE PAGO: ${(quote.paymentTerms || "CONTADO").toUpperCase()}.`, `LUGAR DE ENTREGA: ${(quote.deliveryPlace || "POR DEFINIR").toUpperCase()}.`, ...(configured.length ? configured : fallback), `VIGENCIA ${quote.validityDays} DIAS.`];
};

const getDisplayCost = (
  cost: number,
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD",
  exchangeRate: number
): number => {
  return getErpCostDisplayAmount(cost, productCurrency, quoteCurrency, exchangeRate);
};

const getDisplayCostCurrency = (
  productCurrency: "MXN" | "USD",
  quoteCurrency: "MXN" | "USD"
): "MXN" | "USD" => {
  return getErpCostDisplayCurrency(productCurrency, quoteCurrency);
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

type QuotePdfStyle = "CLASSIC" | "CONTEMPORARY";

interface QuotePrintableDocumentProps {
  quote: SavedQuoteRecord;
  customerDisplayName: string;
  contactName: string;
  deliverySummary: string[];
  pdfStyle: QuotePdfStyle;
  className?: string;
  style?: CSSProperties;
}

const QuotePrintableDocument = forwardRef<HTMLElement, QuotePrintableDocumentProps>(function QuotePrintableDocument(
  { quote, customerDisplayName, contactName, deliverySummary, pdfStyle, className, style },
  ref
) {
  const branchAddressLines = getBranchAddressLines(quote.branch);
  const branchPhones = formatBranchPhones(quote.branch);

  if (pdfStyle === "CONTEMPORARY") {
    const brand = "#fcce01";
    const brandStrong = "#e9b900";
    const brandBright = "#ffdc3d";
    const brandSoft = "#fff9dc";
    const line = "#eadb91";
    const ink = "#282b30";
    const muted = "#62666b";
    const commercialConditions = getCommercialConditions(quote);

    return (
      <article
        ref={ref}
        data-print-root
        data-pdf-style="contemporary"
        className={className}
        style={{
          width: "8.5in",
          minHeight: "11in",
          padding: "0.38in 0.42in 0.32in",
          color: ink,
          boxSizing: "border-box",
          ...printableColorVars,
          ...style,
        }}
      >
        <header className="relative overflow-hidden rounded-md px-5 py-4" style={{ background: `linear-gradient(90deg, ${brandStrong}, ${brandBright})`, color: "#ffffff" }}>
          <div className="absolute -right-7 -top-10 h-24 w-32 rotate-45 opacity-20" style={{ backgroundColor: "#ffffff" }} />
          <div className="relative flex items-center justify-between gap-4">
            <h1 className="text-[22px] font-bold uppercase tracking-[0.16em]">Cotización</h1>
            <div className="rounded px-3 py-2 text-[12px] font-semibold" style={{ backgroundColor: "rgba(40,43,48,0.10)" }}>
              N.° {quote.quoteNumber || quote.quoteId}
            </div>
          </div>
        </header>

        <section className="mt-4 flex items-start justify-between gap-6">
          <div>
            <p className="text-[15px] font-bold" style={{ color: ink }}>Tubería y Válvulas del Norte SA de CV</p>
            <p className="mt-1 text-[9px] leading-4" style={{ color: muted }}>
              Sucursal: {quote.branchName || "-"}<br />
                {branchAddressLines.map((line) => <span key={line}>{line}<br /></span>)}
              {quote.branch.email && <>Correo: {quote.branch.email}<br /></>}
              {branchPhones && <>Teléfono: {branchPhones}<br /></>}
              www.tuvansa.com.mx
            </p>
          </div>

          <div className="w-[2.35in] border-l-[3px] px-3 py-2 text-[9px]" style={{ borderColor: brand, backgroundColor: brandSoft }}>
            <div className="flex justify-between gap-4"><span className="font-semibold" style={{ color: ink }}>Fecha de emisión</span><span>{formatDate(quote.updatedAt || quote.createdAt)}</span></div>
            <div className="mt-1.5 flex justify-between gap-4"><span className="font-semibold" style={{ color: ink }}>Válido hasta</span><span>{formatDate(quote.validUntil)}</span></div>
            <div className="mt-1.5 flex justify-between gap-4"><span className="font-semibold" style={{ color: ink }}>Moneda</span><span>{quote.currency}</span></div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-4 text-[9px] leading-4">
          <div className="border-l-[3px] p-3" style={{ borderColor: brand, backgroundColor: "#ffffff", boxShadow: `0 0 0 1px ${line}` }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: ink }}>› Cliente</p>
            <p className="mt-2 text-[11px] font-bold" style={{ color: ink }}>{customerDisplayName}</p>
            <p style={{ color: muted }}>Contacto: {contactName || "-"}</p>
            <p style={{ color: muted }}>Correo: {quote.client?.email || "-"}</p>
            <p style={{ color: muted }}>WhatsApp: {quote.client?.whatsappPhone || "-"}</p>
          </div>

          <div className="border-l-[3px] p-3" style={{ borderColor: brand, backgroundColor: brandSoft }}>
            <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: ink }}>› Ejecutivo de ventas</p>
            <p className="mt-2 text-[11px] font-bold" style={{ color: ink }}>{quote.createdByName || "-"}</p>
            <p style={{ color: muted }}>Sucursal: {quote.branchName || "-"}</p>
            <p style={{ color: muted }}>Correo: {quote.createdByEmail || "-"}</p>
            <p style={{ color: muted }}>Teléfono: {formatPhoneNumber(quote.createdByPhone) || "-"}</p>
            <p style={{ color: muted }}>Condición de pago: {quote.paymentTerms || "CONTADO"}</p>
            <p style={{ color: muted }}>Lugar de entrega: {quote.deliveryPlace || "Por definir"}</p>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-md">
          <table className="w-full table-fixed border-collapse text-[8px]">
            <thead style={{ background: `linear-gradient(90deg, ${brandStrong}, ${brandBright})`, color: "#ffffff" }}>
              <tr>
                <th className="w-[0.28in] px-1.5 py-2 text-center font-semibold">#</th>
                <th className="w-[0.75in] px-1.5 py-2 text-left font-semibold uppercase">Código</th>
                <th className="px-1.5 py-2 text-left font-semibold uppercase">Descripción</th>
                <th className="w-[0.36in] px-1 py-2 text-center font-semibold uppercase">UM</th>
                <th className="w-[0.48in] px-1 py-2 text-right font-semibold uppercase">Cant.</th>
                <th className="w-[0.86in] px-1.5 py-2 text-right font-semibold uppercase">Precio unit.</th>
                <th className="w-[0.72in] px-1.5 py-2 text-left font-semibold uppercase">Entrega</th>
                <th className="w-[0.88in] px-1.5 py-2 text-right font-semibold uppercase">Importe</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item, index) => (
                <tr key={item.id} style={{ borderBottom: `1px solid ${line}`, backgroundColor: index % 2 === 0 ? "#ffffff" : "#fbfffe" }}>
                  <td className="px-1.5 py-3 text-center align-top font-bold" style={{ color: ink }}>{index + 1}.</td>
                  <td className="px-1.5 py-3 align-top font-medium" style={{ color: muted }}>{item.erpCode || "-"}</td>
                  <td className="px-1.5 py-3 align-top">
                    <p className="font-semibold" style={{ color: ink }}>{item.customerDescription || item.erpDescription || "-"}</p>
                    {item.itemComment && <p className="mt-1 text-[7px] leading-3" style={{ color: muted }}>{item.itemComment}</p>}
                  </td>
                  <td className="px-1 py-3 text-center align-top">{item.unit || "-"}</td>
                  <td className="px-1 py-3 text-right align-top">{item.qty}</td>
                  <td className="px-1.5 py-3 text-right align-top">{formatLineAmount(item.unitPrice)}</td>
                  <td className="px-1.5 py-3 align-top">{item.deliveryTime || "Por definir"}</td>
                  <td className="px-1.5 py-3 text-right align-top font-semibold">{formatLineAmount(item.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="mt-4 flex items-start justify-between gap-8 border-t-2 pt-4" style={{ borderColor: line }}>
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: muted }}>Total de la propuesta</p>
            <p className="mt-1 text-[24px] font-bold" style={{ color: ink }}>{formatCurrency(quote.total, quote.currency)}</p>
            <p className="mt-1 text-[8px]" style={{ color: muted }}>Importes expresados en {quote.currency}.</p>
          </div>

          <div className="w-[2.45in] text-[9px]">
            <div className="flex justify-between px-3 py-1.5"><span className="font-semibold" style={{ color: ink }}>Subtotal</span><span>{formatCurrency(quote.subtotal, quote.currency)}</span></div>
            <div className="flex justify-between px-3 py-1.5"><span className="font-semibold" style={{ color: ink }}>IVA ({(quote.taxRate * 100).toFixed(0)}%)</span><span>{formatCurrency(quote.tax, quote.currency)}</span></div>
            <div className="mt-1 flex justify-between px-3 py-2.5 text-[11px] font-bold" style={{ background: `linear-gradient(90deg, ${brandStrong}, ${brandBright})`, color: "#ffffff" }}>
              <span>Total</span><span>{formatCurrency(quote.total, quote.currency)}</span>
            </div>
          </div>
        </section>

        <section className="mt-5 border-l-[4px] px-4 py-3" style={{ borderColor: brand, backgroundColor: brandSoft }}>
          <p className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: ink }}>Condiciones comerciales</p>
          <div className="mt-2 grid grid-cols-2 gap-x-6 text-[7px] leading-3" style={{ color: muted }}>
            <ol className="list-decimal space-y-1 pl-3">
              {commercialConditions.slice(0, 5).map((condition) => <li key={condition}>{condition}</li>)}
            </ol>
            <ol start={6} className="list-decimal space-y-1 pl-3">
              {commercialConditions.slice(5).map((condition) => <li key={condition}>{condition}</li>)}
            </ol>
          </div>
        </section>

        <footer className="mt-6 border-t-2 px-1 pt-3 text-[8px]" style={{ borderColor: brand, color: muted }}>
          <div className="flex items-end justify-between gap-6">
            <div><p className="font-bold" style={{ color: ink }}>Tubería y Válvulas del Norte SA de CV</p><p>{quote.branchName || "Sucursal"}</p></div>
            <div className="text-center"><p>{quote.branchName || "Sucursal"}</p><p>{quote.paymentTerms || "CONTADO"}</p></div>
            <div className="text-right"><p>{quote.currency}</p><p>{quote.quoteNumber || quote.quoteId}</p></div>
          </div>
        </footer>
      </article>
    );
  }

  return (
    <article
      ref={ref}
      data-print-root
      className={className}
      style={{ width: "8.5in", minHeight: "11in", padding: "0.55in", ...printableColorVars, ...style }}
    >
      <header className="border-b border-gray-200 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">Cotización</p>
            <h1 className="text-2xl font-semibold">Propuesta Comercial</h1>
            <p className="mt-1 text-[10px] font-semibold text-gray-700">Tubería y Válvulas del Norte SA de CV</p>
            <p className="text-[9px] leading-3 text-gray-500">Sucursal: {quote.branchName || "-"}</p>
              {branchAddressLines.map((line) => <p key={line} className="text-[9px] leading-3 text-gray-500">{line}</p>)}
            {quote.branch.email && <p className="text-[9px] leading-3 text-gray-500">{quote.branch.email}{branchPhones ? ` · ${branchPhones}` : ""}</p>}
            {!quote.branch.email && branchPhones && <p className="text-[9px] leading-3 text-gray-500">{branchPhones}</p>}
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
            <span className="font-semibold">Correo:</span> {quote.createdByEmail || "-"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Teléfono:</span> {formatPhoneNumber(quote.createdByPhone) || "-"}
          </p>
          <p className="text-xs text-gray-700">
            <span className="font-semibold">Proporcionada por:</span> {quote.providedBy?.fullName || "Directa"}
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
                <th className="px-2 py-2 text-left font-semibold uppercase text-gray-500">Comentario</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white text-[10px] leading-4">
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-2 py-2 align-top font-semibold">{item.erpCode || "-"}</td>
                  <td className="px-2 py-2 align-top">{item.customerDescription || item.erpDescription || "-"}</td>
                  <td className="px-2 py-2 align-top">{item.unit || "-"}</td>
                  <td className="px-2 py-2 text-right align-top">{item.qty}</td>
                  <td className="px-2 py-2 text-right align-top">{formatCurrency(item.unitPrice, quote.currency)}</td>
                  <td className="px-2 py-2 text-right align-top font-semibold">
                    {formatCurrency(item.subtotal, quote.currency)}
                  </td>
                  <td className="px-2 py-2 align-top">{item.deliveryTime || "Por definir"}</td>
                  <td className="px-2 py-2 align-top">{item.itemComment || "-"}</td>
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
          {getCommercialConditions(quote).map((condition) => <li key={condition}>{condition}</li>)}
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
  const currentUser = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const quoteInternalApprovalEnabled = capabilities.data?.quoteInternalApprovalEnabled ?? true;
  const sellerExcelImportEnabled = capabilities.data?.sellerExcelImportEnabled ?? true;
  const currentRole = (currentUser?.role || "").trim().toLowerCase();
  const { quoteId } = useParams<{ quoteId: string }>();
  const navigate = useNavigate();
  const [showCustomerOrderColumns, setShowCustomerOrderColumns] = useState(false);
  const [showItemComments, setShowItemComments] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfStyle, setPdfStyle] = useState<QuotePdfStyle>("CLASSIC");
  const [showSendModal, setShowSendModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showAttachmentsModal, setShowAttachmentsModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showErpRegistrationModal, setShowErpRegistrationModal] = useState(false);
  const [erpQuoteNumberDraft, setErpQuoteNumberDraft] = useState("");
  const [rejectionReason, setRejectionReason] = useState<QuoteRejectionReason | "">("");
  const [rejectionComment, setRejectionComment] = useState("");
  const [cancellationReason, setCancellationReason] = useState<QuoteCancellationReason | "">("");
  const [cancellationComment, setCancellationComment] = useState("");
  const [revisionReason, setRevisionReason] = useState<QuoteRevisionReason | "">("");
  const [revisionComment, setRevisionComment] = useState("");
  const [archiveReason, setArchiveReason] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [sendChannel, setSendChannel] = useState<"WHATSAPP" | "EMAIL" | "BOTH">("BOTH");
  const [sendRecipientOptions, setSendRecipientOptions] = useState<SendRecipientOption[]>([]);
  const [selectedWhatsAppRecipientId, setSelectedWhatsAppRecipientId] = useState("");
  const [selectedEmailRecipientId, setSelectedEmailRecipientId] = useState("");
  const [loadingRecipients, setLoadingRecipients] = useState(false);
  const [recipientsError, setRecipientsError] = useState("");
  const [orderGeneratedLocal, setOrderGeneratedLocal] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [busyAttachmentId, setBusyAttachmentId] = useState<string | null>(null);
  const printableRef = useRef<HTMLElement | null>(null);

  const { data: quote, isLoading, refetch } = useQuoteDetail(quoteId);
  const quoteAttachments = useQuoteAttachments(quoteId);
  const {
    data: purchaseRequisition,
    refetch: refetchPurchaseRequisition,
  } = useQuotePurchaseRequisition(
    quoteId,
    quote?.captureMethod !== "EXCEL_IMPORT"
      && (quote?.status === "APROBADA" || quote?.orderStatus === "GENERADO")
  );
  const updateStatus = useUpdateQuoteStatus();
  const createRevision = useCreateQuoteRevision();
  const archiveQuote = useArchiveQuote();
  const restoreQuote = useRestoreQuote();
  const deleteQuote = useDeleteQuotePermanently();
  const generateOrder = useGenerateQuoteOrder();
  const downloadOrderFile = useDownloadQuoteOrderFile();
  const registerDeliveryAttempt = useRegisterQuoteDeliveryAttempt();
  const registerErpQuote = useRegisterErpQuote();
  const revisionCatalog = useQuoteCatalogs("REVISION_REASON");
  const rejectionCatalog = useQuoteCatalogs("REJECTION_REASON");
  const cancellationCatalog = useQuoteCatalogs("CANCELLATION_REASON");
  const approvalReturnCatalog = useQuoteCatalogs("APPROVAL_RETURN_REASON");
  const revisionOptions = revisionCatalog.data?.map((option) => ({ value: option.code, label: option.label, requiresComment: option.requiresComment })) ?? REVISION_REASON_OPTIONS.map((option) => ({ ...option, requiresComment: option.value === "OTHER" }));
  const rejectionOptions = rejectionCatalog.data?.map((option) => ({ value: option.code, label: option.label, requiresComment: option.requiresComment })) ?? REJECTION_REASON_OPTIONS.map((option) => ({ ...option, requiresComment: option.value === "OTHER" }));
  const cancellationOptions = cancellationCatalog.data?.map((option) => ({ value: option.code, label: option.label, requiresComment: option.requiresComment })) ?? CANCELLATION_REASON_OPTIONS.map((option) => ({ ...option, requiresComment: option.value === "OTHER" }));
  const approvalReturnOptions = approvalReturnCatalog.data?.map((option) => ({ value: option.code, label: option.label })) ?? [];
  const revisionRequiresComment = revisionOptions.find((option) => option.value === revisionReason)?.requiresComment || false;
  const rejectionRequiresComment = rejectionOptions.find((option) => option.value === rejectionReason)?.requiresComment || false;
  const cancellationRequiresComment = cancellationOptions.find((option) => option.value === cancellationReason)?.requiresComment || false;

  const downloadAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.download(file);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo descargar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const deleteAttachment = async (file: FileAttachment) => {
    setBusyAttachmentId(file.id);
    try {
      await AttachmentsService.delete(file.id);
      await quoteAttachments.refetch();
      notifier.success("Archivo eliminado.");
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo eliminar el archivo.");
    } finally {
      setBusyAttachmentId(null);
    }
  };

  const isActionLocked =
    actionInProgress ||
    updateStatus.isPending ||
    createRevision.isPending ||
    archiveQuote.isPending ||
    restoreQuote.isPending ||
    deleteQuote.isPending ||
    generateOrder.isPending ||
    downloadOrderFile.isPending ||
    registerDeliveryAttempt.isPending ||
    registerErpQuote.isPending;
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
  const hasItemComments = quote.items.some((item) => (item.itemComment || "").trim().length > 0);
  const company = quote.client?.companyName?.trim() || "";
  const contactName = `${quote.client?.name || ""} ${quote.client?.lastname || ""}`.trim();
  const customerDisplayName = company || contactName || "Cliente sin nombre";
  const deliverySummary = Array.from(
    new Set(quote.items.map((item) => (item.deliveryTime || "").trim()).filter(Boolean))
  );
  const attachmentItemLabels = Object.fromEntries(
    quote.items.map((item, index) => [item.id, `#${index + 1} ${item.erpCode || "LOCAL"}`]),
  );
  const isArchived = Boolean(quote.archivedAt);
  const canSubmitApproval = !isArchived && currentRole === "seller" && ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"].includes(quote.status);
  const canApproveInternally = quoteInternalApprovalEnabled && !isArchived && ["admin", "manager"].includes(currentRole) && quote.status === "PENDIENTE_APROBACION";
  const canEditQuote = !isArchived
    && currentRole === "seller"
    && ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"].includes(quote.status)
    && (quote.captureMethod !== "EXCEL_IMPORT" || sellerExcelImportEnabled);
  const hasRevisionInProgress = Boolean(
    quote.nextRevision && ["DRAFT", "PENDING", "PENDING_APPROVAL", "CHANGES_REQUESTED"].includes(quote.nextRevision.status)
  );
  const canCreateRevision =
    currentRole === "seller" &&
    !isArchived &&
    ["COTIZADA", "APROBADA", "RECHAZADA"].includes(quote.status) &&
    quote.orderStatus !== "GENERADO" &&
    (quote.captureMethod !== "EXCEL_IMPORT" || sellerExcelImportEnabled) &&
    !quote.supersededByQuoteId &&
    !hasRevisionInProgress;
  const canSendQuote =
    !isArchived && !hasRevisionInProgress && (quote.status === "COTIZADA" || quote.status === "APROBADA" || quote.status === "RECHAZADA");
  const canDownloadQuotePdf =
    quote.status === "COTIZADA" || quote.status === "APROBADA" || quote.status === "RECHAZADA" || quote.status === "REEMPLAZADA";
  const canApproveReject = !isArchived && quote.status === "COTIZADA" && !hasRevisionInProgress;
  const purchaseReady = !purchaseRequisition || ["READY_FOR_ORDER", "COMPLETED"].includes(purchaseRequisition.status);
  const canGenerateOrder =
    quote.captureMethod !== "EXCEL_IMPORT"
    && !isArchived
    && quote.status === "APROBADA"
    && quote.orderStatus !== "GENERADO"
    && !hasRevisionInProgress;
  const canDownloadOrder =
    quote.captureMethod !== "EXCEL_IMPORT"
    && (quote.status === "APROBADA" || quote.orderStatus === "GENERADO" || orderGeneratedLocal);
  const canRegisterErpQuote =
    quote.captureMethod === "EXCEL_IMPORT"
    && !isArchived
    && quote.status === "APROBADA"
    && !hasRevisionInProgress;
  const canPermanentlyDelete =
    currentRole === "admin" &&
    ["BORRADOR", "CANCELADA"].includes(quote.status) &&
    quote.orderStatus !== "GENERADO" &&
    quote.revisionNumber === 0 &&
    !quote.rootQuoteId &&
    !quote.previousVersionId &&
    !quote.supersededByQuoteId &&
    !quote.nextRevision;

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
    if (!cancellationReason) {
      notifier.warning("Selecciona el motivo de cancelación.");
      return;
    }
    if (cancellationRequiresComment && !cancellationComment.trim()) {
      notifier.warning("Describe el motivo de cancelación.");
      return;
    }

    await runActionWithToast({
      loadingMessage: "Cancelando cotización...",
      action: () => updateStatus.mutateAsync({
        quoteId: quote.quoteId,
        status: "CANCELADA",
        cancellation: { reason: cancellationReason, comment: cancellationComment.trim() || undefined },
      }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización cancelada.",
      errorMessage: "No se pudo cancelar la cotización.",
      onSuccess: async () => {
        setShowCancellationModal(false);
        setCancellationReason("");
        setCancellationComment("");
        await refetch();
      },
    });
  };

  const handleCreateRevision = async () => {
    if (!revisionReason) {
      notifier.warning("Selecciona el motivo de la revisión.");
      return;
    }
    if (revisionRequiresComment && !revisionComment.trim()) {
      notifier.warning("Describe el motivo de la revisión.");
      return;
    }

    await runActionWithToast({
      loadingMessage: "Creando revisión...",
      action: () => createRevision.mutateAsync({
        quoteId: quote.quoteId,
        reason: revisionReason,
        comment: revisionComment.trim() || undefined,
      }),
      successMessage: (revision) => `Revisión ${revision.quoteNumber} creada como borrador.`,
      errorMessage: "No se pudo crear la revisión.",
      onSuccess: (revision) => {
        setShowRevisionModal(false);
        setRevisionReason("");
        setRevisionComment("");
        const editorPath = quote.captureMethod === "EXCEL_IMPORT" ? "/cotizador/importar-excel" : "/cotizador/sistema";
        navigate(`${editorPath}?quoteId=${revision.quoteId}`);
      },
    });
  };

  const handleArchiveQuote = async () => {
    if (!archiveReason.trim()) {
      notifier.warning("Escribe el motivo del archivado.");
      return;
    }
    await runActionWithToast({
      loadingMessage: "Archivando cotización...",
      action: () => archiveQuote.mutateAsync({ quoteId: quote.quoteId, reason: archiveReason.trim() }),
      successMessage: "Cotización archivada.",
      onSuccess: async () => {
        setShowArchiveModal(false);
        setArchiveReason("");
        await refetch();
      },
    });
  };

  const handleRestoreQuote = async () => {
    await runActionWithToast({
      loadingMessage: "Restaurando cotización...",
      action: () => restoreQuote.mutateAsync({ quoteId: quote.quoteId }),
      successMessage: "Cotización restaurada.",
      onSuccess: async () => { await refetch(); },
    });
  };

  const handleDeleteQuote = async () => {
    if (!deleteReason.trim() || deleteConfirmation.trim() !== quote.quoteNumber) {
      notifier.warning("Escribe el motivo y confirma el folio exactamente.");
      return;
    }
    await runActionWithToast({
      loadingMessage: "Eliminando cotización definitivamente...",
      action: () => deleteQuote.mutateAsync({
        quoteId: quote.quoteId,
        confirmation: deleteConfirmation.trim(),
        reason: deleteReason.trim(),
      }),
      successMessage: "Cotización eliminada definitivamente.",
      onSuccess: () => navigate("/quotes"),
    });
  };

  const handleSubmitApproval = async () => {
    await runActionWithToast({
      loadingMessage: quoteInternalApprovalEnabled
        ? "Enviando cotización a aprobación..."
        : "Generando cotización...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "PENDIENTE_APROBACION" }),
      isSuccess: (result) => Boolean(result),
      successMessage: quoteInternalApprovalEnabled
        ? "Cotización enviada a aprobación."
        : "Cotización generada correctamente.",
      errorMessage: quoteInternalApprovalEnabled
        ? "No se pudo enviar a aprobación."
        : "No se pudo generar la cotización.",
      onSuccess: async () => {
        await refetch();
      },
    });
  };

  const handleInternalApproval = async () => {
    await runActionWithToast({
      loadingMessage: "Autorizando cotización...",
      action: () => updateStatus.mutateAsync({ quoteId: quote.quoteId, status: "COTIZADA" }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización autorizada y marcada como COTIZADA.",
      errorMessage: "No se pudo autorizar la cotización.",
      onSuccess: async () => { await refetch(); },
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
        if (quote.captureMethod !== "EXCEL_IMPORT") {
          await refetchPurchaseRequisition();
        }
      },
    });
  };

  const openErpRegistrationModal = () => {
    setErpQuoteNumberDraft(quote.erpQuoteNumber || "");
    setShowErpRegistrationModal(true);
  };

  const handleRegisterErpQuote = async () => {
    const erpQuoteNumber = erpQuoteNumberDraft.trim();
    if (!erpQuoteNumber) {
      notifier.warning("Escribe el número de cotización del ERP.");
      return;
    }

    await runActionWithToast({
      loadingMessage: quote.erpQuoteNumber
        ? "Actualizando folio de cotización ERP..."
        : "Registrando cotización en ERP...",
      action: () => registerErpQuote.mutateAsync({ quoteId: quote.quoteId, erpQuoteNumber }),
      successMessage: quote.erpQuoteNumber
        ? "Folio de cotización ERP actualizado."
        : "Cotización registrada en ERP.",
      errorMessage: "No se pudo registrar la cotización en ERP.",
      onSuccess: async () => {
        setShowErpRegistrationModal(false);
        setErpQuoteNumberDraft("");
        await refetch();
      },
    });
  };

  const handleRejectQuote = async () => {
    if (!rejectionReason) {
      notifier.warning("Selecciona el motivo de rechazo.");
      return;
    }
    if (rejectionRequiresComment && !rejectionComment.trim()) {
      notifier.warning("Describe el motivo de rechazo.");
      return;
    }

    await runActionWithToast({
      loadingMessage: "Marcando cotización como RECHAZADA...",
      action: () => updateStatus.mutateAsync({
        quoteId: quote.quoteId,
        status: "RECHAZADA",
        rejection: { reason: rejectionReason, comment: rejectionComment.trim() || undefined },
      }),
      isSuccess: (result) => Boolean(result),
      successMessage: "Cotización marcada como RECHAZADA.",
      errorMessage: "No se pudo marcar la cotización como RECHAZADA.",
      onSuccess: async () => {
        setShowRejectionModal(false);
        setRejectionReason("");
        setRejectionComment("");
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
          <h2 className="text-lg font-semibold text-gray-800">Cotización {quote.quoteNumber}</h2>
          <p className="text-xs text-gray-500">Creada: {new Date(quote.createdAt).toLocaleString("es-MX")}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className={` flex justify-center items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}`}>{quote.status}</span>
          {quote.captureMethod === "EXCEL_IMPORT" && (
            <span className="flex items-center rounded-full bg-teal-100 px-2 py-1 text-xs font-semibold text-teal-700">
              IMPORTADA EXCEL
            </span>
          )}
          {quote.erpQuoteNumber && (
            <span className="flex items-center rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
              ERP {quote.erpQuoteNumber}
            </span>
          )}

          <button
            onClick={() => navigate(`${quote.captureMethod === "EXCEL_IMPORT" ? "/cotizador/importar-excel" : "/cotizador/sistema"}?quoteId=${quote.quoteId}`)}
            disabled={isActionLocked || !canEditQuote}
            title={!canEditQuote ? (quote.captureMethod === "EXCEL_IMPORT" && !sellerExcelImportEnabled ? "La edición de cotizaciones Excel está deshabilitada." : "Esta cotización no se puede editar en su estado actual.") : undefined}
            className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
          >
            <Pencil className="h-4 w-4" />
            Editar
          </button>

          {canCreateRevision && (
            <button
              onClick={() => setShowRevisionModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 ${disabledActionClass}`}
            >
              <RefreshCw className="h-4 w-4" />
              Crear revisión
            </button>
          )}

          {currentRole === "admin" && !isArchived && (
            <button
              onClick={() => setShowArchiveModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 ${disabledActionClass}`}
            >
              <Archive className="h-4 w-4" />
              Archivar
            </button>
          )}

          {currentRole === "admin" && isArchived && (
            <button
              onClick={() => void handleRestoreQuote()}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-900 ${disabledActionClass}`}
            >
              <ArchiveRestore className="h-4 w-4" />
              Restaurar
            </button>
          )}

          {canPermanentlyDelete && (
            <button
              onClick={() => setShowDeleteModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 ${disabledActionClass}`}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar definitivamente
            </button>
          )}

          <button
            onClick={() => setShowPdfPreview(true)}
            disabled={isActionLocked}
            className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
          >
            <FileText className="h-4 w-4" />
            Vista PDF
          </button>

          <button
            onClick={() => setShowAttachmentsModal(true)}
            disabled={isActionLocked}
            className={`inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 ${disabledActionClass}`}
          >
            <Paperclip className="h-4 w-4" />
            Archivos adjuntos ({quoteAttachments.data?.length || 0})
          </button>

          {canDownloadQuotePdf && (
            <button
              onClick={handleDownloadQuotePdf}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Download className="h-4 w-4" />
              Descargar cotización (PDF)
            </button>
          )}

          {canSendQuote && (
            <button
              onClick={() => setShowSendModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Send className="h-4 w-4" />
              Enviar
            </button>
          )}

          {canGenerateOrder && (
            <button
              onClick={handleGenerateOrder}
              disabled={isActionLocked || !purchaseReady}
              title={!purchaseReady ? "Compras debe completar la requisición antes de generar el pedido." : undefined}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <ShoppingCart className="h-4 w-4" />
              Generar pedido (.txt)
            </button>
          )}

          {canDownloadOrder && (
            <button
              onClick={handleDownloadOrderFile}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
            >
              <Download className="h-4 w-4" />
              {isActionLocked ? "Procesando..." : "Descargar pedido"}
            </button>
          )}

          {canSubmitApproval && (
            <button
              onClick={handleSubmitApproval}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 ${disabledActionClass}`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {quoteInternalApprovalEnabled ? "Enviar a aprobación" : "Generar cotización"}
            </button>
          )}

          {canApproveInternally && (
            <button
              onClick={handleInternalApproval}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 ${disabledActionClass}`}
            >
              <ShieldCheck className="h-4 w-4" />
              Autorizar cotización
            </button>
          )}

          {canApproveReject && (
            <button
              onClick={handleApproveQuote}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 ${disabledActionClass}`}
            >
              <ThumbsUp className="h-4 w-4" />
              Marcar aprobada por cliente
            </button>
          )}

          {canRegisterErpQuote && (
            <button
              onClick={openErpRegistrationModal}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 ${disabledActionClass}`}
            >
              <BadgeCheck className="h-4 w-4" />
              {quote.erpQuoteNumber ? "Corregir folio ERP" : "Registrar en ERP"}
            </button>
          )}

          {canApproveReject && (
            <button
              onClick={() => setShowRejectionModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-orange-600 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-700 ${disabledActionClass}`}
            >
              <ThumbsDown className="h-4 w-4" />
              Marcar rechazada
            </button>
          )}

          {!isArchived && !["CANCELADA", "REEMPLAZADA"].includes(quote.status) && !hasRevisionInProgress && (
            <button
              onClick={() => setShowCancellationModal(true)}
              disabled={isActionLocked}
              className={`inline-flex items-center gap-2 rounded-md bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-700 ${disabledActionClass}`}
            >
              <CircleSlash className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
      </div>

      {isArchived && (
        <div className="mb-4 rounded-md border border-slate-300 bg-slate-100 p-4">
          <p className="text-sm font-semibold text-slate-900">Cotización archivada</p>
          <p className="mt-1 text-xs text-slate-700">
            {quote.archiveReason || "Sin motivo registrado."}
            {quote.archivedByUser
              ? ` Archivada por ${quote.archivedByUser.firstName} ${quote.archivedByUser.lastName}.`
              : ""}
          </p>
        </div>
      )}

      {hasRevisionInProgress && quote.nextRevision && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div>
            <p className="text-sm font-semibold text-amber-950">Revisión en proceso</p>
            <p className="text-xs text-amber-800">
              El envío y la generación de pedido están bloqueados hasta resolver {quote.nextRevision.quoteNumber}.
            </p>
          </div>
          <NavLink
            to={`/quotes/${quote.nextRevision.id}`}
            className="rounded-md bg-amber-700 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-800"
          >
            Ver revisión
          </NavLink>
        </div>
      )}

      {purchaseRequisition && (
        <div className={`mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 ${purchaseReady ? "border-emerald-300 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
          <div>
            <p className={`text-sm font-semibold ${purchaseReady ? "text-emerald-950" : "text-amber-950"}`}>
              Requisición {purchaseRequisition.requisitionNumber}
            </p>
            <p className={`text-xs ${purchaseReady ? "text-emerald-800" : "text-amber-800"}`}>
              {purchaseReady
                ? "Compras terminó las partidas requeridas. El pedido ERP está habilitado."
                : `Estado: ${purchaseRequisition.status}. El pedido permanece bloqueado.`}
            </p>
          </div>
          <NavLink
            to="/procurement"
            className={`rounded-md px-3 py-2 text-xs font-semibold text-white ${purchaseReady ? "bg-emerald-700 hover:bg-emerald-800" : "bg-amber-700 hover:bg-amber-800"}`}
          >
            Ver requisición
          </NavLink>
        </div>
      )}

      {quote.status === "REEMPLAZADA" && quote.supersededByQuoteId && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-300 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-800">Esta versión fue reemplazada</p>
            <p className="text-xs text-gray-600">Consulta la revisión autorizada que sustituyó esta cotización.</p>
          </div>
          <NavLink
            to={`/quotes/${quote.supersededByQuoteId}`}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100"
          >
            Ver versión vigente
          </NavLink>
        </div>
      )}

      <div className="mb-4 grid gap-3 rounded-md border border-gray-200 bg-white p-4 md:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Vendedor</p>
          <p className="text-sm text-gray-700">{quote.createdByName || "-"}</p>
        </div>

        {quote.authorizedByUser && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Autorizada por</p>
            <p className="text-sm text-gray-700">
              {`${quote.authorizedByUser.firstName} ${quote.authorizedByUser.lastName}`.trim()}
            </p>
            {quote.authorizedAt && (
              <p className="mt-1 text-xs text-gray-500">{formatDate(quote.authorizedAt)}</p>
            )}
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Sucursal</p>
          <p className="text-sm text-gray-700">{quote.branchName || "-"}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Proporcionada por</p>
          <p className="text-sm text-gray-700">{quote.providedBy?.fullName || "Directa"}</p>
        </div>

        {quote.revisionNumber > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase text-gray-500">Revisión</p>
            <p className="text-sm font-semibold text-amber-700">R{String(quote.revisionNumber).padStart(2, "0")}</p>
            {quote.revisionReason && <p className="text-xs text-gray-600">{catalogReasonLabel(quote.revisionReason, revisionOptions, revisionReasonLabel)}</p>}
            {quote.previousVersionId && (
              <NavLink to={`/quotes/${quote.previousVersionId}`} className="mt-1 inline-block text-xs font-semibold text-blue-600 hover:text-blue-800">
                Ver versión anterior
              </NavLink>
            )}
          </div>
        )}

        {quote.revisionComment && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-amber-700">Detalle de la revisión</p>
            <p className="mt-1 text-sm text-amber-950">{quote.revisionComment}</p>
          </div>
        )}

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Moneda</p>
          <p className="text-sm text-gray-700">{quote.currency}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Origen de la cotización</p>
          <p className="text-sm text-gray-700">{sourceChannelLabel[quote.sourceChannel]}</p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase text-gray-500">Método de captura</p>
          <p className="text-sm text-gray-700">
            {quote.captureMethod === "EXCEL_IMPORT" ? "Importada desde Excel" : "Capturada en el sistema"}
          </p>
          {quote.captureMethod === "EXCEL_IMPORT" && quote.originalQuoteDate && (
            <p className="mt-1 text-xs text-gray-500">Fecha original: {formatDate(quote.originalQuoteDate)}</p>
          )}
        </div>

        {quote.captureMethod === "EXCEL_IMPORT" && (
          <div className={`rounded-md border p-3 ${quote.erpQuoteNumber ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
            <p className={`text-xs font-semibold uppercase ${quote.erpQuoteNumber ? "text-emerald-700" : "text-amber-700"}`}>
              Cotización ERP
            </p>
            <p className={`mt-1 text-sm font-semibold ${quote.erpQuoteNumber ? "text-emerald-950" : "text-amber-950"}`}>
              {quote.erpQuoteNumber || "Pendiente de registrar"}
            </p>
            {quote.erpQuoteRegisteredAt && (
              <p className="mt-1 text-[11px] text-emerald-700">
                Registrada {new Date(quote.erpQuoteRegisteredAt).toLocaleString("es-MX")}
                {quote.erpQuoteRegisteredByUser
                  ? ` por ${quote.erpQuoteRegisteredByUser.firstName} ${quote.erpQuoteRegisteredByUser.lastName}`
                  : ""}
              </p>
            )}
          </div>
        )}

        {quote.rejectionReason && (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-orange-700">Motivo de rechazo</p>
            <p className="mt-1 text-sm font-semibold text-orange-950">{catalogReasonLabel(quote.rejectionReason, rejectionOptions, rejectionReasonLabel)}</p>
            {quote.rejectionComment && <p className="mt-1 text-xs text-orange-900">{quote.rejectionComment}</p>}
            <p className="mt-2 text-[11px] text-orange-700">
              Registrado {quote.rejectedAt ? formatDate(quote.rejectedAt) : "-"}
              {quote.rejectedByUser ? ` por ${quote.rejectedByUser.firstName} ${quote.rejectedByUser.lastName}` : ""}
            </p>
          </div>
        )}

        {quote.cancellationReason && (
          <div className="rounded-md border border-rose-200 bg-rose-50 p-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-rose-700">Motivo de cancelación</p>
            <p className="mt-1 text-sm font-semibold text-rose-950">{catalogReasonLabel(quote.cancellationReason, cancellationOptions, cancellationReasonLabel)}</p>
            {quote.cancellationComment && <p className="mt-1 text-xs text-rose-900">{quote.cancellationComment}</p>}
            <p className="mt-2 text-[11px] text-rose-700">
              Registrado {quote.cancelledAt ? formatDate(quote.cancelledAt) : "-"}
              {quote.cancelledByUser ? ` por ${quote.cancelledByUser.firstName} ${quote.cancelledByUser.lastName}` : ""}
            </p>
          </div>
        )}

        {quote.approvalReturnReason && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 md:col-span-2">
            <p className="text-xs font-semibold uppercase text-amber-700">Cambios solicitados por aprobación</p>
            <p className="mt-1 text-sm font-semibold text-amber-950">{catalogReasonLabel(quote.approvalReturnReason, approvalReturnOptions, (reason) => reason?.replaceAll("_", " ") || "Sin especificar")}</p>
            {quote.approvalReturnComment && <p className="mt-1 text-xs text-amber-900">{quote.approvalReturnComment}</p>}
          </div>
        )}

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
        {(showCustomerExtractionColumns || hasItemComments) && (
          <div className="flex justify-end border-b border-gray-200 px-3 py-2">
            <div className="flex gap-2">
              {showCustomerExtractionColumns && (
                <button
                  type="button"
                  onClick={() => setShowCustomerOrderColumns((prev) => !prev)}
                  disabled={isActionLocked}
                  className={`rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
                >
                  {showCustomerOrderColumns ? "Ocultar pedido cliente" : "Mostrar pedido cliente"}
                </button>
              )}
              {hasItemComments && (
                <button
                  type="button"
                  onClick={() => setShowItemComments((prev) => !prev)}
                  disabled={isActionLocked}
                  className={`rounded-md border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 ${disabledActionClass}`}
                >
                  {showItemComments ? "Ocultar comentarios" : "Mostrar comentarios"}
                </button>
              )}
            </div>
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
              {showItemComments && (
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase text-gray-500">Comentario</th>
              )}
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
                  ) : quote.captureMethod === "EXCEL_IMPORT" ? (
                    <span className="rounded-full bg-teal-100 px-2 py-1 text-[10px] font-semibold text-teal-700">EXCEL · SIN VINCULAR</span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">EXTRACCIÓN · SIN VINCULAR</span>
                  )}
                </td>
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">
                    <p>{item.customerDescription || "-"}</p>
                    {item.customerDescriptionOriginal?.trim()
                      && item.customerDescriptionOriginal.trim() !== (item.customerDescription || "").trim() && (
                        <div className="mt-2 border-t border-gray-100 pt-2">
                          <p className="text-[9px] font-semibold uppercase tracking-wide text-gray-400">Original</p>
                          <p className="mt-0.5 text-[10px] leading-4 text-gray-500">{item.customerDescriptionOriginal}</p>
                        </div>
                      )}
                  </td>
                )}
                {showCustomerExtractionColumns && showCustomerOrderColumns && (
                  <td className="px-3 py-2 text-xs text-gray-700">{item.customerUnit || "-"}</td>
                )}
                <td className="px-3 py-2 text-xs text-gray-700">{item.erpDescription || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.unit || "-"}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.stock}</td>
                <td className="px-3 py-2 text-xs text-gray-700">{item.deliveryTime}</td>
                {showItemComments && <td className="px-3 py-2 text-xs text-gray-700">{item.itemComment || "-"}</td>}
                <td className="px-3 py-2 text-xs text-gray-700">{item.qty}</td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  {formatCurrency(
                    getDisplayCost(item.costUsd, item.costCurrency || "USD", quote.currency, quote.exchangeRate),
                    getDisplayCostCurrency(item.costCurrency || "USD", quote.currency)
                  )}
                  {(item.effectiveCostAtQuote ?? 0) > 0 && (
                    <p className="mt-1 whitespace-nowrap text-[10px] font-semibold text-slate-500">
                      Efectivo: {formatCurrency(item.effectiveCostAtQuote ?? 0, quote.currency)}
                    </p>
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-gray-700">
                  <span>{item.marginPct}%</span>
                  {item.isBelowEffectiveCost && (
                    <div className="mt-1 max-w-48 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-semibold leading-4 text-rose-700">
                      <p>Debajo del costo efectivo ({(item.effectiveCostVariancePct ?? 0).toFixed(2)}%)</p>
                      <p>Diferencia: {formatCurrency(item.effectiveCostVariance ?? 0, quote.currency)}</p>
                      {item.effectiveCostEvaluatedByUser && (
                        <p>
                          Registrado por {item.effectiveCostEvaluatedByUser.firstName} {item.effectiveCostEvaluatedByUser.lastName}
                          {item.effectiveCostEvaluatedAt ? ` · ${formatDate(item.effectiveCostEvaluatedAt)}` : ""}
                        </p>
                      )}
                    </div>
                  )}
                </td>
                <td className={`px-3 py-2 text-xs ${item.isBelowEffectiveCost ? "font-semibold text-rose-700" : "text-gray-700"}`}>{formatCurrency(item.unitPrice, quote.currency)}</td>
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

      {showAttachmentsModal && (
        <AttachmentsModal
          title={`Archivos de ${quote.quoteNumber}`}
          files={quoteAttachments.data || []}
          loading={quoteAttachments.isLoading}
          itemLabels={attachmentItemLabels}
          canDelete={(file) => currentRole === "admin" || (
            file.uploadedByUserId === currentUser?.id
            && ["BORRADOR", "PENDIENTE", "CAMBIOS_SOLICITADOS"].includes(quote.status)
          )}
          busyFileId={busyAttachmentId}
          onClose={() => setShowAttachmentsModal(false)}
          onDownload={(file) => { void downloadAttachment(file); }}
          onDelete={(file) => { void deleteAttachment(file); }}
        />
      )}

      {showErpRegistrationModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            onClick={() => !isActionLocked && setShowErpRegistrationModal(false)}
            disabled={isActionLocked}
            className="absolute inset-0 bg-slate-950/50"
            aria-label="Cerrar registro ERP"
          />
          <div className="relative w-full max-w-md rounded-md border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {quote.erpQuoteNumber ? "Corregir folio ERP" : "Registrar en ERP"}
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  Captura el número asignado cuando esta cotización fue generada manualmente en el ERP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowErpRegistrationModal(false)}
                disabled={isActionLocked}
                className={`rounded-md p-1 text-slate-500 hover:bg-slate-100 ${disabledActionClass}`}
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase text-slate-600">
              Número de cotización ERP *
            </label>
            <input
              value={erpQuoteNumberDraft}
              onChange={(event) => setErpQuoteNumberDraft(event.target.value.toUpperCase())}
              onKeyDown={(event) => {
                if (event.key === "Enter" && erpQuoteNumberDraft.trim() && !isActionLocked) {
                  event.preventDefault();
                  void handleRegisterErpQuote();
                }
              }}
              maxLength={80}
              disabled={isActionLocked}
              autoFocus
              placeholder="Ej. COT-ERP-12345"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold uppercase outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
            />
            <p className="mt-2 text-[11px] text-slate-500">
              El folio debe ser único y quedará ligado al usuario que haga el registro.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowErpRegistrationModal(false)}
                disabled={isActionLocked}
                className={`rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 ${disabledActionClass}`}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRegisterErpQuote()}
                disabled={isActionLocked || !erpQuoteNumberDraft.trim()}
                className={`rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-800 ${disabledActionClass}`}
              >
                {isActionLocked ? "Guardando..." : "Guardar folio ERP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showArchiveModal && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-md bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Archivar cotización</h3>
            <p className="mt-1 text-xs text-slate-600">
              Se ocultará de los listados activos, pero conservará historial, métricas y auditoría.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-600">Motivo *</label>
            <textarea
              value={archiveReason}
              onChange={(event) => setArchiveReason(event.target.value)}
              rows={4}
              maxLength={500}
              disabled={isActionLocked}
              className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-500"
              placeholder="Indica por qué se archiva..."
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowArchiveModal(false)}
                disabled={isActionLocked}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleArchiveQuote()}
                disabled={isActionLocked || !archiveReason.trim()}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {isActionLocked ? "Archivando..." : "Confirmar archivado"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-md border border-red-200 bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-red-800">Eliminar cotización definitivamente</h3>
            <p className="mt-1 text-xs text-slate-600">
              Esta operación elimina partidas y eventos relacionados. El registro resumido de auditoría permanecerá.
            </p>
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-600">Motivo *</label>
            <textarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              rows={3}
              maxLength={500}
              disabled={isActionLocked}
              className="mt-1 w-full resize-y rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              placeholder="Explica por qué debe eliminarse..."
            />
            <label className="mt-4 block text-xs font-semibold uppercase text-slate-600">
              Escribe {quote.quoteNumber} para confirmar *
            </label>
            <input
              value={deleteConfirmation}
              onChange={(event) => setDeleteConfirmation(event.target.value)}
              disabled={isActionLocked}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-red-500"
              autoComplete="off"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isActionLocked}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleDeleteQuote()}
                disabled={isActionLocked || !deleteReason.trim() || deleteConfirmation.trim() !== quote.quoteNumber}
                className="rounded-md bg-red-700 px-3 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActionLocked ? "Eliminando..." : "Eliminar definitivamente"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRevisionModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            onClick={() => !isActionLocked && setShowRevisionModal(false)}
            disabled={isActionLocked}
            className="absolute inset-0 bg-black/45"
            aria-label="Cerrar creación de revisión"
          />
          <div className="relative w-full max-w-lg rounded-md border border-gray-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Crear revisión de cotización</h3>
                <p className="mt-1 text-xs text-gray-600">
                  Se creará una copia editable. Esta versión permanecerá intacta hasta que la revisión sea autorizada.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                disabled={isActionLocked}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase text-gray-600">Motivo de la revisión *</label>
            <select
              value={revisionReason}
              onChange={(event) => setRevisionReason(event.target.value as QuoteRevisionReason | "")}
              disabled={isActionLocked}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">Selecciona un motivo...</option>
              {revisionOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-600">
              Comentario {revisionRequiresComment ? "*" : "(opcional)"}
            </label>
            <textarea
              value={revisionComment}
              onChange={(event) => setRevisionComment(event.target.value)}
              disabled={isActionLocked}
              rows={4}
              maxLength={500}
              placeholder="Describe los cambios que deben realizarse..."
              className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500">{revisionComment.length}/500</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRevisionModal(false)}
                disabled={isActionLocked}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleCreateRevision()}
                disabled={isActionLocked || !revisionReason || (revisionRequiresComment && !revisionComment.trim())}
                className="rounded-md bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isActionLocked ? "Creando..." : "Crear revisión"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRejectionModal && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Motivo de rechazo</h3>
                <p className="mt-1 text-sm text-gray-500">Registra por qué el cliente no avanzó con la cotización.</p>
              </div>
              <button
                onClick={() => !isActionLocked && setShowRejectionModal(false)}
                disabled={isActionLocked}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase text-gray-500" htmlFor="rejection-reason">
              Motivo <span className="text-rose-600">*</span>
            </label>
            <select
              id="rejection-reason"
              value={rejectionReason}
              onChange={(event) => setRejectionReason(event.target.value as QuoteRejectionReason | "")}
              disabled={isActionLocked}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="">Selecciona un motivo...</option>
              {rejectionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500" htmlFor="rejection-comment">
              Comentario {rejectionRequiresComment ? <span className="text-rose-600">*</span> : <span className="normal-case text-gray-400">(opcional)</span>}
            </label>
            <textarea
              id="rejection-comment"
              value={rejectionComment}
              onChange={(event) => setRejectionComment(event.target.value)}
              disabled={isActionLocked}
              rows={4}
              maxLength={500}
              placeholder={rejectionRequiresComment ? "Describe el motivo de rechazo..." : "Agrega contexto opcional..."}
              className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500">{rejectionComment.length}/500</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowRejectionModal(false)}
                disabled={isActionLocked}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleRejectQuote()}
                disabled={isActionLocked || !rejectionReason || (rejectionRequiresComment && !rejectionComment.trim())}
                className="rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionLocked ? "Guardando..." : "Confirmar rechazo"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCancellationModal && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/45 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Motivo de cancelación</h3>
                <p className="mt-1 text-sm text-gray-500">Registra el motivo interno por el que se cancela esta cotización.</p>
              </div>
              <button
                onClick={() => !isActionLocked && setShowCancellationModal(false)}
                disabled={isActionLocked}
                className="rounded-md p-1 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <label className="mt-5 block text-xs font-semibold uppercase text-gray-500" htmlFor="cancellation-reason">
              Motivo <span className="text-rose-600">*</span>
            </label>
            <select
              id="cancellation-reason"
              value={cancellationReason}
              onChange={(event) => setCancellationReason(event.target.value as QuoteCancellationReason | "")}
              disabled={isActionLocked}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-rose-500"
            >
              <option value="">Selecciona un motivo...</option>
              {cancellationOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>

            <label className="mt-4 block text-xs font-semibold uppercase text-gray-500" htmlFor="cancellation-comment">
              Comentario {cancellationRequiresComment ? <span className="text-rose-600">*</span> : <span className="normal-case text-gray-400">(opcional)</span>}
            </label>
            <textarea
              id="cancellation-comment"
              value={cancellationComment}
              onChange={(event) => setCancellationComment(event.target.value)}
              disabled={isActionLocked}
              rows={4}
              maxLength={500}
              placeholder={cancellationRequiresComment ? "Describe el motivo de cancelación..." : "Agrega contexto opcional..."}
              className="mt-1 w-full resize-y rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 outline-none focus:ring-2 focus:ring-rose-500"
            />
            <p className="mt-1 text-right text-[11px] text-gray-500">{cancellationComment.length}/500</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowCancellationModal(false)}
                disabled={isActionLocked}
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Volver
              </button>
              <button
                onClick={() => void handleCancelQuote()}
                disabled={isActionLocked || !cancellationReason || (cancellationRequiresComment && !cancellationComment.trim())}
                className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isActionLocked ? "Guardando..." : "Confirmar cancelación"}
              </button>
            </div>
          </div>
        </div>
      )}

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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-gray-800">Vista previa PDF</h3>
                <p className="text-xs text-gray-500">Elige el estilo antes de descargar, imprimir o enviar al cliente.</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <div className="mr-1 inline-flex items-center rounded-lg border border-gray-300 bg-white p-1 shadow-sm" aria-label="Estilo del PDF">
                  <span className="px-2 text-gray-400" aria-hidden="true"><Palette className="h-4 w-4" /></span>
                  <button
                    type="button"
                    onClick={() => setPdfStyle("CLASSIC")}
                    disabled={isActionLocked}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${pdfStyle === "CLASSIC" ? "bg-slate-800 text-white shadow-sm" : "text-gray-600 hover:bg-gray-100"} ${disabledActionClass}`}
                  >
                    Clásico
                  </button>
                  <button
                    type="button"
                    onClick={() => setPdfStyle("CONTEMPORARY")}
                    disabled={isActionLocked}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${pdfStyle === "CONTEMPORARY" ? "bg-[#fcce01] text-slate-900 shadow-sm" : "text-gray-600 hover:bg-gray-100"} ${disabledActionClass}`}
                  >
                    Contemporáneo
                  </button>
                </div>
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
              pdfStyle={pdfStyle}
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
          pdfStyle={pdfStyle}
          className="bg-white text-gray-900"
        />
      </div>
    </section>
  );
};
