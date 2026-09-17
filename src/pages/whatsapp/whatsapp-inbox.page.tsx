import {
  ChatBox,
  chatBoxClasses,
  chatComposerClasses,
  chatConversationListClasses,
  chatMessageClasses,
  chatMessageListClasses,
} from "@mui/x-chat";
import { Avatar, Box, Button, Chip, CircularProgress, Divider, Drawer, IconButton, Paper, Stack, Typography } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ChatMessage } from "@mui/x-chat-headless";
import { Bot, Building2, ChevronRight, Clock3, ExternalLink, FilePlus2, FileText, Headphones, History, Mail, MapPin, MessageCircleMore, ShieldCheck, UserPlus, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { CustomersService } from "../../modules/clients/services/customers.service";
import type { Client, ClientInput } from "../../modules/clients/types/client.types";
import { emptyCustomerContact } from "../../modules/clients/utils/customer-contact-form";
import { clientWithSelectedContact } from "../../modules/clients/utils/customer-contact-selection";
import { MuiWhatsAppChatAdapter } from "../../modules/whatsapp/adapters/mui-whatsapp-chat.adapter";
import type { WhatsAppRealtimeStatus } from "../../modules/whatsapp/services/whatsapp-realtime.service";
import { WhatsAppQuoteExtractionService } from "../../modules/whatsapp/services/whatsapp-quote-extraction.service";
import {
  WhatsAppInboxService,
  type WhatsAppInboxConversation,
  type WhatsAppInboundAttachment,
  type WhatsAppConversationMode,
  type WhatsAppRelatedQuote,
} from "../../modules/whatsapp/services/whatsapp-inbox.service";
import { notifier } from "../../shared/notifications/notifier";
import { SelectClientModal } from "../../shared/components/modals/select-client.modal";
import { useAuthStore } from "../../store/auth/auth.store";
import { useManualQuoteStore } from "../../store/quote/manual-quote.store";
import { AssignWhatsAppLeadModal } from "./assign-whatsapp-lead.modal";
import { WhatsAppFileMessagePart } from "./whatsapp-file-message-part";
import { FilePreviewModal } from "../../shared/components/file-preview/file-preview.modal";
import type { ManagedUser } from "../../modules/users/services/users.service";
import { ConfirmWhatsAppQuoteExtractionModal } from "./confirm-whatsapp-quote-extraction.modal";

const chatTheme = createTheme({
  palette: {
    primary: { main: "#172033", contrastText: "#ffffff" },
    secondary: { main: "#fcce01", contrastText: "#111827" },
    background: { default: "#f8fafc", paper: "#ffffff" },
    text: { primary: "#172033", secondary: "#64748b" },
  },
  typography: {
    fontFamily: '"DM Sans", "Avenir Next", sans-serif',
    fontSize: 13,
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { textTransform: "none", fontWeight: 700 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700 },
      },
    },
  },
});

const isWindowActive = (lastInboundAt: string | null, now: number): boolean =>
  Boolean(lastInboundAt && Date.parse(lastInboundAt) + 24 * 60 * 60 * 1000 > now);

const initials = (value: string): string =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const leadStatusLabel: Record<string, string> = {
  NEW: "Prospecto nuevo",
  COLLECTING_INFORMATION: "Recopilando información",
  PENDING_ASSIGNMENT: "Pendiente de asignación",
  ASSIGNED: "Prospecto asignado",
  CONVERTED: "Convertido en cliente",
  DISCARDED: "Prospecto descartado",
};

const quoteStatusLabel: Record<string, string> = {
  DRAFT: "Borrador",
  PENDING: "Pendiente",
  PENDING_APPROVAL: "Pendiente de aprobación",
  CHANGES_REQUESTED: "Cambios solicitados",
  QUOTED: "Cotizada",
  APPROVED: "Aprobada por el cliente",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  SUPERSEDED: "Reemplazada",
};

const quoteStatusStyle: Record<string, { backgroundColor: string; color: string }> = {
  DRAFT: { backgroundColor: "#f1f5f9", color: "#475569" },
  PENDING: { backgroundColor: "#fff7cc", color: "#7c5b00" },
  PENDING_APPROVAL: { backgroundColor: "#fff7cc", color: "#7c5b00" },
  CHANGES_REQUESTED: { backgroundColor: "#ffedd5", color: "#9a3412" },
  QUOTED: { backgroundColor: "#dbeafe", color: "#1d4ed8" },
  APPROVED: { backgroundColor: "#dcfce7", color: "#047857" },
  REJECTED: { backgroundColor: "#fee2e2", color: "#b91c1c" },
  CANCELLED: { backgroundColor: "#f1f5f9", color: "#64748b" },
  SUPERSEDED: { backgroundColor: "#f1f5f9", color: "#64748b" },
};

const quoteSections = [
  { key: "IN_PROGRESS", label: "En proceso", statuses: ["DRAFT", "PENDING", "PENDING_APPROVAL", "CHANGES_REQUESTED"] },
  { key: "QUOTED", label: "Cotizadas", statuses: ["QUOTED"] },
  { key: "APPROVED", label: "Aprobadas", statuses: ["APPROVED"] },
  { key: "CLOSED", label: "Cerradas", statuses: ["REJECTED", "CANCELLED", "SUPERSEDED"] },
] as const;

const formatQuoteTotal = (quote: WhatsAppRelatedQuote): string =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: quote.currency,
    minimumFractionDigits: 2,
  }).format(quote.total);

const formatQuoteDate = (value: string): string =>
  new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));

interface RelatedQuoteFamily {
  primary: WhatsAppRelatedQuote;
  versions: WhatsAppRelatedQuote[];
}

const groupRelatedQuotes = (quotes: WhatsAppRelatedQuote[]): RelatedQuoteFamily[] => {
  const families = new Map<string, WhatsAppRelatedQuote[]>();
  quotes.forEach((quote) => {
    const key = quote.rootQuoteId || quote.id;
    families.set(key, [...(families.get(key) || []), quote]);
  });
  return [...families.values()].map((versions) => {
    const sorted = [...versions].sort((left, right) =>
      Number(right.isCurrent) - Number(left.isCurrent)
      || right.revisionNumber - left.revisionNumber
      || Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
    return { primary: sorted[0], versions: sorted };
  }).sort((left, right) =>
    Number(right.primary.isCurrent) - Number(left.primary.isCurrent)
    || Date.parse(right.primary.updatedAt) - Date.parse(left.primary.updatedAt));
};

export const WhatsAppInboxPage = () => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const quoteDraft = useManualQuoteStore((state) => state.draft);
  const clearQuoteDraft = useManualQuoteStore((state) => state.clearDraft);
  const initializeQuoteDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setQuoteClient = useManualQuoteStore((state) => state.setClient);
  const setQuoteSourceChannel = useManualQuoteStore((state) => state.setSourceChannel);
  const setQuoteWhatsAppLeadId = useManualQuoteStore((state) => state.setWhatsAppLeadId);
  const setItemsFromExtraction = useManualQuoteStore((state) => state.setItemsFromExtraction);
  const displayName = `${user?.name || ""} ${user?.lastname || ""}`.trim() || "Usuario Tuvansa";
  const [conversationData, setConversationData] = useState<WhatsAppInboxConversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [selected, setSelected] = useState<WhatsAppInboxConversation>();
  const [changingMode, setChangingMode] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [realtimeStatus, setRealtimeStatus] = useState<WhatsAppRealtimeStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [assignLeadOpen, setAssignLeadOpen] = useState(false);
  const [assigningLead, setAssigningLead] = useState(false);
  const [convertLeadOpen, setConvertLeadOpen] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [quotesDrawerOpen, setQuotesDrawerOpen] = useState(false);
  const [prospectDrawerOpen, setProspectDrawerOpen] = useState(false);
  const [relatedQuotes, setRelatedQuotes] = useState<WhatsAppRelatedQuote[]>([]);
  const [relatedQuotesLoading, setRelatedQuotesLoading] = useState(false);
  const [relatedQuotesConversationId, setRelatedQuotesConversationId] = useState<string>();
  const [previewAttachment, setPreviewAttachment] = useState<WhatsAppInboundAttachment | null>(null);
  const [quoteExtractionAttachment, setQuoteExtractionAttachment] = useState<WhatsAppInboundAttachment | null>(null);
  const [generatingQuoteAttachmentId, setGeneratingQuoteAttachmentId] = useState<string | null>(null);
  const activeIdRef = useRef<string | undefined>(undefined);

  const handleConversationData = useCallback((items: WhatsAppInboxConversation[]) => {
    setConversationData(items);
  }, []);

  const handleRealtimeStatus = useCallback((status: WhatsAppRealtimeStatus) => {
    setRealtimeStatus(status);
  }, []);

  const handleMessageData = useCallback((conversationId: string, nextMessages: ChatMessage[]) => {
    if (activeIdRef.current === conversationId) setMessages(nextMessages);
  }, []);

  const adapter = useMemo(
    () => new MuiWhatsAppChatAdapter(
      { id: user?.id || "current-user", displayName },
      handleConversationData,
      handleRealtimeStatus,
      handleMessageData,
    ),
    [displayName, handleConversationData, handleMessageData, handleRealtimeStatus, user?.id],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!activeId) {
      setSelected(undefined);
      return;
    }
    adapter.setActiveConversation(activeId);
    const cached = adapter.getConversation(activeId);
    if (cached) setSelected(cached);
    void WhatsAppInboxService.get(activeId)
      .then((result) => {
        adapter.updateConversation(result);
        setSelected(result);
      })
      .catch(() => undefined);
  }, [activeId, adapter]);

  useEffect(() => {
    if (!activeId) return;
    const updated = conversationData.find((item) => item.id === activeId);
    if (updated) setSelected(updated);
  }, [activeId, conversationData]);

  useEffect(() => {
    setQuotesDrawerOpen(false);
    setProspectDrawerOpen(false);
    setRelatedQuotes([]);
    setRelatedQuotesConversationId(undefined);
    setPreviewAttachment(null);
    setQuoteExtractionAttachment(null);
  }, [activeId]);

  const relatedQuoteFamilies = useMemo(() => groupRelatedQuotes(relatedQuotes), [relatedQuotes]);

  const openRelatedQuotes = async () => {
    if (!selected) return;
    setQuotesDrawerOpen(true);
    if (relatedQuotesConversationId === selected.id) return;
    setRelatedQuotesLoading(true);
    try {
      const result = await WhatsAppInboxService.quotes(selected.id);
      setRelatedQuotes(result.items);
      setRelatedQuotesConversationId(selected.id);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudieron cargar las cotizaciones.");
    } finally {
      setRelatedQuotesLoading(false);
    }
  };

  const generateQuoteFromAttachment = async (attachment: WhatsAppInboundAttachment) => {
    if (!selected || generatingQuoteAttachmentId) return;
    if (user?.role?.toLowerCase() !== "seller") {
      notifier.warning("Solo los vendedores pueden generar cotizaciones.");
      return;
    }
    if (hasActiveQuoteDraft()) {
      notifier.warning("Tienes una cotización en proceso. Guárdala o descártala antes de generar otra desde WhatsApp.");
      return;
    }

    setGeneratingQuoteAttachmentId(attachment.id);
    const toastId = notifier.loading(`Extrayendo partidas de ${attachment.originalName}...`);
    try {
      let customer: Client | null = null;
      if (selected.customerId) {
        const loaded = await CustomersService.getById(selected.customerId);
        const contact = loaded.contacts?.find((item) => item.id === selected.contactId)
          || loaded.contacts?.find((item) => item.isPrimary)
          || loaded.contacts?.[0];
        customer = clientWithSelectedContact(loaded, contact);
      }

      clearQuoteDraft();
      initializeQuoteDraft(user);
      setQuoteSourceChannel("AI_ASSISTANT");
      if (selected.lead?.id) setQuoteWhatsAppLeadId(selected.lead.id);
      if (customer) setQuoteClient(customer);

      const draftId = useManualQuoteStore.getState().draft.id;
      const result = await WhatsAppQuoteExtractionService.extract(
        attachment,
        draftId,
      );

      try {
        const updatedAttachment = await WhatsAppInboxService.markAttachmentQuoteExtracted(
          attachment.id,
          draftId,
        );
        adapter.updateAttachment(updatedAttachment);
      } catch (trackingError) {
        notifier.warning(
          trackingError instanceof Error
            ? trackingError.message
            : "Las partidas se extrajeron, pero no se pudo actualizar el estado del archivo.",
        );
      }

      setItemsFromExtraction(result.items);
      if (toastId !== undefined) {
        notifier.update(toastId, "success", `Se cargaron ${result.items.length} partidas en la cotización.`);
      } else {
        notifier.success(`Se cargaron ${result.items.length} partidas en la cotización.`);
      }
      setQuoteExtractionAttachment(null);
      navigate("/cotizador/sistema");
    } catch (error) {
      clearQuoteDraft();
      initializeQuoteDraft(user);
      const message = error instanceof Error ? error.message : "No se pudo generar la cotización desde el archivo.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setGeneratingQuoteAttachmentId(null);
    }
  };

  const windowActive = isWindowActive(selected?.lastInboundAt || null, now);
  const canReply = Boolean(selected && selected.mode === "HUMAN" && windowActive);
  const canAssignLead = Boolean(
    selected?.lead
    && ["admin", "manager"].includes(user?.role?.toLowerCase() || ""),
  );
  const canConvertLead = Boolean(
    selected?.lead
    && user?.role?.toLowerCase() === "seller"
    && selected.lead.assignedSellerId === user.id
    && selected.lead.status !== "DISCARDED",
  );

  const leadCustomerInitialValues = useMemo<Partial<ClientInput> | undefined>(() => {
    if (!selected?.lead) return undefined;
    const fullName = selected.lead.contactName?.trim() || "";
    const [name = "", ...lastNameParts] = fullName.split(/\s+/).filter(Boolean);
    const contact = emptyCustomerContact(true);
    contact.name = fullName;
    contact.email = selected.lead.email || "";
    contact.mobile = selected.participantPhone;
    contact.label = "Prospecto WhatsApp";
    return {
      name,
      lastname: lastNameParts.join(" "),
      companyName: selected.lead.companyName || "",
      email: selected.lead.email || "",
      whatsappPhone: selected.participantPhone,
      billingCity: selected.lead.location || "",
      billingCountry: "MÉXICO",
      profileStatus: "PROSPECT",
      notes: selected.lead.requestSummary || "",
      contacts: [contact],
    };
  }, [selected]);

  const hasActiveQuoteDraft = (): boolean => Boolean(
    quoteDraft.savedQuoteId
    || quoteDraft.client
    || quoteDraft.items.length > 0
    || quoteDraft.sourceChannel !== "UNSPECIFIED",
  );

  const openQuoteForLead = (client: Client, leadId: string) => {
    if (hasActiveQuoteDraft() && quoteDraft.whatsappLeadId !== leadId) {
      notifier.warning("Tienes una cotización en proceso. Guárdala o descártala antes de iniciar la del prospecto.");
      return;
    }
    if (quoteDraft.whatsappLeadId === leadId) {
      navigate("/cotizador/sistema");
      return;
    }
    clearQuoteDraft();
    initializeQuoteDraft(user);
    setQuoteClient(client);
    setQuoteSourceChannel("AI_ASSISTANT");
    setQuoteWhatsAppLeadId(leadId);
    navigate("/cotizador/sistema");
  };

  const loadConvertedLeadCustomer = async () => {
    if (!selected?.lead?.customerId || convertingLead) return;
    setConvertingLead(true);
    const toastId = notifier.loading("Preparando cotización del prospecto...");
    try {
      const customer = await CustomersService.getById(selected.lead.customerId);
      const contact = customer.contacts?.find((item) => item.id === selected.contactId)
        || customer.contacts?.find((item) => item.isPrimary)
        || customer.contacts?.[0];
      openQuoteForLead(clientWithSelectedContact(customer, contact), selected.lead.id);
      if (toastId !== undefined) notifier.update(toastId, "success", "Cliente y prospecto listos para cotizar.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo preparar la cotización.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setConvertingLead(false);
    }
  };

  const convertLeadAndOpenQuote = async (client: Client) => {
    if (!selected?.lead || convertingLead) return;
    setConvertingLead(true);
    const toastId = notifier.loading("Vinculando prospecto con el cliente...");
    try {
      const updated = await WhatsAppInboxService.convertLead(
        selected.id,
        client.id,
        client.selectedContactId || null,
      );
      adapter.updateConversation(updated);
      setSelected(updated);
      setConvertLeadOpen(false);
      const customer = await CustomersService.getById(client.id);
      const contact = customer.contacts?.find((item) => item.id === updated.contactId)
        || customer.contacts?.find((item) => item.id === client.selectedContactId)
        || customer.contacts?.find((item) => item.isPrimary)
        || customer.contacts?.[0];
      if (toastId !== undefined) notifier.update(toastId, "success", "Prospecto convertido en cliente.");
      else notifier.success("Prospecto convertido en cliente.");
      openQuoteForLead(clientWithSelectedContact(customer, contact), selected.lead.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo vincular el prospecto.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setConvertingLead(false);
    }
  };

  const assignLead = async (seller: ManagedUser) => {
    if (!selected || assigningLead) return;
    setAssigningLead(true);
    const toastId = notifier.loading(`Asignando prospecto a ${seller.fullName}...`);
    try {
      const updated = await WhatsAppInboxService.assignLead(selected.id, seller.id);
      adapter.updateConversation(updated);
      setSelected(updated);
      if (toastId !== undefined) notifier.update(toastId, "success", `Prospecto asignado a ${seller.fullName}.`);
      else notifier.success(`Prospecto asignado a ${seller.fullName}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo asignar el prospecto.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
      throw error;
    } finally {
      setAssigningLead(false);
    }
  };

  const changeMode = async (mode: WhatsAppConversationMode) => {
    if (!selected || changingMode) return;
    setChangingMode(true);
    const toastId = notifier.loading(mode === "HUMAN" ? "Tomando conversación..." : "Activando asistente...");
    try {
      const updated = await WhatsAppInboxService.setMode(selected.id, mode);
      adapter.updateConversation(updated);
      setSelected(updated);
      const message = mode === "HUMAN"
        ? "Ahora puedes responder manualmente."
        : "El asistente de IA atenderá los siguientes mensajes.";
      if (toastId !== undefined) notifier.update(toastId, "success", message);
      else notifier.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo cambiar el modo.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setChangingMode(false);
    }
  };

  return (
    <ThemeProvider theme={chatTheme}>
      <Paper
        component="section"
        elevation={0}
        sx={{
          display: "flex",
          height: "calc(100vh - 7.5rem)",
          minHeight: 560,
          flexDirection: "column",
          overflow: "hidden",
          border: "1px solid",
          borderColor: "#dbe2ea",
          borderRadius: 2,
          boxShadow: "0 14px 40px rgba(15, 23, 42, 0.06)",
        }}
      >
        <Box
          component="header"
          sx={{
            display: "flex",
            flexDirection: { xs: "column", lg: "row" },
            alignItems: { lg: "center" },
            justifyContent: "space-between",
            gap: 1.5,
            px: { xs: 2, md: 2.5 },
            py: 1.5,
            borderBottom: "1px solid",
            borderColor: "#e2e8f0",
            background: "linear-gradient(105deg, #fff8d1 0%, #ffffff 46%, #f8fafc 100%)",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar
              variant="rounded"
              sx={{ width: 42, height: 42, bgcolor: "secondary.main", color: "#111827" }}
            >
              <MessageCircleMore size={21} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={800} lineHeight={1.2}>
                Mensajes de WhatsApp
              </Typography>
              <Stack direction="row" alignItems="center" spacing={0.75}>
                <Typography variant="caption" color="text.secondary">
                  {conversationData.length} conversaciones visibles según tus permisos
                </Typography>
                <Box
                  component="span"
                  sx={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    bgcolor: realtimeStatus === "connected" ? "#10b981" : "#f59e0b",
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  {realtimeStatus === "connected" ? "Tiempo real conectado" : "Reconectando..."}
                </Typography>
              </Stack>
            </Box>
          </Stack>

          {selected ? (
            <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
              <Chip
                size="small"
                icon={<Clock3 size={15} />}
                label={windowActive ? "Ventana de 24 h activa" : "Fuera de ventana de 24 h"}
                sx={{
                  bgcolor: windowActive ? "#ecfdf5" : "#f1f5f9",
                  color: windowActive ? "#047857" : "#64748b",
                  border: "1px solid",
                  borderColor: windowActive ? "#a7f3d0" : "#e2e8f0",
                  "& .MuiChip-icon": { color: "inherit" },
                }}
              />
              {selected.quote && (
                <Button
                  component={NavLink}
                  to={`/quotes/${selected.quote.id}`}
                  size="small"
                  variant="outlined"
                  endIcon={<ExternalLink size={15} />}
                  sx={{ color: "#334155", borderColor: "#cbd5e1", bgcolor: "#ffffff" }}
                >
                  {selected.quote.quoteNumber}
                </Button>
              )}
              {selected.lead && (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  startIcon={<Building2 size={15} />}
                  onClick={() => setProspectDrawerOpen(true)}
                  sx={{ color: "#6b5200", borderColor: "#e5b900", bgcolor: "#fffbea" }}
                >
                  Datos del prospecto
                </Button>
              )}
              <Button
                type="button"
                size="small"
                variant="outlined"
                startIcon={<History size={15} />}
                onClick={() => void openRelatedQuotes()}
                sx={{ color: "#334155", borderColor: "#cbd5e1", bgcolor: "#ffffff" }}
              >
                Cotizaciones{relatedQuotesConversationId === selected.id ? ` (${relatedQuoteFamilies.length})` : ""}
              </Button>
              {canAssignLead && (
                <Button
                  type="button"
                  size="small"
                  variant="outlined"
                  color="secondary"
                  disabled={assigningLead}
                  onClick={() => setAssignLeadOpen(true)}
                  startIcon={assigningLead ? <CircularProgress size={14} color="inherit" /> : <UserPlus size={15} />}
                  sx={{ borderColor: "#e5b900", bgcolor: "#fffbea", color: "#6b5200" }}
                >
                  {selected.lead?.assignedSellerId ? "Reasignar vendedor" : "Asignar vendedor"}
                </Button>
              )}
              {canConvertLead && (
                <Button
                  type="button"
                  size="small"
                  variant="contained"
                  color="secondary"
                  disabled={convertingLead}
                  onClick={() => {
                    if (hasActiveQuoteDraft() && quoteDraft.whatsappLeadId !== selected.lead?.id) {
                      notifier.warning("Tienes una cotización en proceso. Guárdala o descártala antes de iniciar la del prospecto.");
                      return;
                    }
                    if (selected.lead?.customerId) void loadConvertedLeadCustomer();
                    else setConvertLeadOpen(true);
                  }}
                  startIcon={convertingLead ? <CircularProgress size={14} color="inherit" /> : <FilePlus2 size={15} />}
                  sx={{ bgcolor: "#fcce01", color: "#111827", "&:hover": { bgcolor: "#e8bd00" } }}
                >
                  {selected.lead?.customerId ? "Crear cotización" : "Vincular cliente y cotizar"}
                </Button>
              )}
              <Button
                type="button"
                size="small"
                variant={selected.mode === "AI" ? "contained" : "outlined"}
                color={selected.mode === "AI" ? "primary" : "secondary"}
                disabled={changingMode}
                onClick={() => void changeMode(selected.mode === "AI" ? "HUMAN" : "AI")}
                startIcon={changingMode
                  ? <CircularProgress size={14} color="inherit" />
                  : selected.mode === "AI"
                    ? <Headphones size={15} />
                    : <Bot size={15} />}
                sx={selected.mode === "HUMAN" ? { borderColor: "#e5b900", bgcolor: "#fffbea" } : undefined}
              >
                {selected.mode === "AI" ? "Tomar conversación" : "Devolver a la IA"}
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" spacing={0.75} color="text.secondary">
              <ShieldCheck size={17} color="#d4a900" />
              <Typography variant="caption" fontWeight={600}>
                Selecciona una conversación para consultar su contexto.
              </Typography>
            </Stack>
          )}
        </Box>

        {selected && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.25,
              px: { xs: 2, md: 2.5 },
              py: 1,
              borderBottom: "1px solid",
              borderColor: "#e8edf3",
              bgcolor: "#ffffff",
            }}
          >
            <Avatar sx={{ width: 36, height: 36, bgcolor: "#172033", fontSize: 12, fontWeight: 800 }}>
              {initials(selected.contactName || selected.customerName)}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={800} noWrap>
                {selected.contactName || selected.customerName}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap component="p">
                {selected.customerName} · {selected.participantPhone}
                {selected.sellerName ? ` · Vendedor: ${selected.sellerName}` : ""}
              </Typography>
            </Box>
            {selected.lead && (
              <Chip
                size="small"
                label={leadStatusLabel[selected.lead.status] || selected.lead.status}
                sx={{ bgcolor: selected.lead.status === "ASSIGNED" ? "#ecfdf5" : "#fff7cc", color: selected.lead.status === "ASSIGNED" ? "#047857" : "#7c5b00" }}
              />
            )}
            <Chip
              size="small"
              icon={selected.mode === "AI" ? <Bot size={14} /> : <Headphones size={14} />}
              label={selected.mode === "AI" ? "Atiende IA" : `Atiende ${selected.handledByName || "usuario"}`}
              sx={{
                flexShrink: 0,
                bgcolor: selected.mode === "AI" ? "#eff6ff" : "#fff7cc",
                color: selected.mode === "AI" ? "#1d4ed8" : "#7c5b00",
                "& .MuiChip-icon": { color: "inherit" },
              }}
            />
          </Box>
        )}

        <Box sx={{ minHeight: 0, flex: 1 }}>
          <ChatBox
            adapter={adapter}
            partRenderers={{
              file: ({ part }) => {
                const attachment = adapter.getAttachment(part.url);
                const supportedForExtraction = attachment
                  ? WhatsAppQuoteExtractionService.supports(attachment)
                  : false;
                const sellerCanGenerate = user?.role?.toLowerCase() === "seller";
                return attachment
                  ? (
                      <WhatsAppFileMessagePart
                        attachment={attachment}
                        onOpen={() => setPreviewAttachment(attachment)}
                        onGenerateQuote={sellerCanGenerate && supportedForExtraction
                          ? () => setQuoteExtractionAttachment(attachment)
                          : undefined}
                        generateQuoteDisabledReason={!supportedForExtraction
                          ? "Disponible para PDF, XLS o XLSX"
                          : !sellerCanGenerate
                            ? "Solo vendedores"
                            : undefined}
                        generating={generatingQuoteAttachmentId === attachment.id}
                      />
                    )
                  : null;
              },
            }}
            messages={messages}
            onMessagesChange={setMessages}
            currentUser={{ id: user?.id || "current-user", displayName, role: "user" }}
            members={[
              { id: user?.id || "current-user", displayName, role: "user" },
              { id: "tuvansa-ai", displayName: "Asistente Tuvansa", role: "user" },
            ]}
            onActiveConversationChange={(conversationId) => {
              const changedConversation = activeIdRef.current !== conversationId;
              activeIdRef.current = conversationId;
              setActiveId(conversationId);
              if (changedConversation) setMessages([]);
            }}
            onError={(error) => notifier.error(error.message || "No se pudo completar la acción en WhatsApp.")}
            variant="default"
            density="compact"
            features={{
              conversationList: true,
              conversationHeader: false,
              dateDivider: true,
              unreadMarker: true,
              attachments: false,
              helperText: true,
              suggestions: false,
              streamingIndicator: false,
            }}
            localeText={{
              conversationListSearchPlaceholder: "Buscar cliente, contacto o cotización",
              conversationListNoConversationsLabel: "No hay conversaciones para mostrar",
              composerInputPlaceholder: canReply
                ? "Escribe una respuesta..."
                : selected?.mode === "AI"
                  ? "Toma la conversación para responder"
                  : "La ventana de 24 horas no está activa",
              threadNoMessagesLabel: "Aún no hay mensajes",
              threadNoMessagesHelperText: "Los mensajes enviados y recibidos aparecerán aquí.",
              unreadMarkerLabel: "Mensajes nuevos",
              messageAuthorAssistantLabel: "Cliente",
              messageAuthorUserLabel: "Tuvansa",
              loadingLabel: "Cargando conversaciones...",
            }}
            slots={{ composerAttachButton: null, messageAvatar: null }}
            slotProps={{
              messageGroup: {
                groupKey: (message) => `${message.author?.id || message.role}:${message.author?.displayName || ""}`,
              },
              composerInput: { disabled: !canReply, maxRows: 5 },
              composerSendButton: { disabled: !canReply },
              composerHelperText: {
                children: canReply
                  ? "Enter para enviar. Shift + Enter para nueva línea."
                  : "Toma la conversación dentro de la ventana de 24 horas para responder.",
              },
            }}
            sx={{
              height: "100%",
              minHeight: 0,
              [`& .${chatBoxClasses.layout}`]: { height: "100%", backgroundColor: "#f8fafc" },
              [`& .${chatBoxClasses.conversationsPane}`]: {
                "--ChatBox-conversationListWidth": "330px",
                borderRight: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              },
              [`& .${chatBoxClasses.threadPane}`]: {
                backgroundColor: "#f4f1eb",
                backgroundImage:
                  "radial-gradient(circle at 12px 12px, rgba(100,116,139,0.055) 1px, transparent 1.2px)",
                backgroundSize: "24px 24px",
              },
              [`& .${chatConversationListClasses.root}`]: { bgcolor: "#ffffff" },
              [`& .${chatConversationListClasses.scroller}`]: { px: 0.5, py: 0.75 },
              [`& .${chatConversationListClasses.item}`]: {
                borderRadius: "12px",
                margin: "3px 6px",
                width: "calc(100% - 12px)",
                minHeight: 68,
                transition: "background-color 140ms ease, transform 140ms ease",
                "&:hover": { backgroundColor: "#f8fafc", transform: "translateX(2px)" },
              },
              [`& .${chatConversationListClasses.itemSelected}`]: {
                backgroundColor: "#fff6bf !important",
                boxShadow: "inset 3px 0 0 #fcce01",
              },
              [`& .${chatConversationListClasses.itemAvatar}`]: {
                bgcolor: "#172033",
                color: "#ffffff",
                fontWeight: 800,
              },
              [`& .${chatConversationListClasses.itemTitle}`]: { color: "#172033", fontWeight: 800 },
              [`& .${chatConversationListClasses.itemPreview}`]: { color: "#64748b" },
              [`& .${chatConversationListClasses.itemUnreadBadge}`]: {
                backgroundColor: "#fcce01",
                color: "#111827",
              },
              [`& .${chatMessageListClasses.scroller}`]: { px: { xs: 1.25, md: 3 }, py: 2 },
              [`& .${chatMessageListClasses.content}`]: { gap: 0.75 },
              [`& .${chatMessageClasses.root}`]: { maxWidth: "100%" },
              [`& .${chatMessageClasses.content}`]: { maxWidth: { xs: "86%", md: "72%" } },
              [`& .${chatMessageClasses.roleUser} .${chatMessageClasses.bubble}`]: {
                backgroundColor: "#fff0a6",
                color: "#172033",
                border: "1px solid #efd66c",
                borderRadius: "14px 14px 3px 14px",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.08)",
              },
              [`& .${chatMessageClasses.roleUser} .${chatMessageClasses.content}`]: {
                justifySelf: "end",
                alignItems: "flex-end",
              },
              [`& .${chatMessageClasses.roleAssistant} .${chatMessageClasses.bubble}`]: {
                backgroundColor: "#ffffff",
                color: "#273449",
                border: "1px solid #dfe5eb",
                borderRadius: "14px 14px 14px 3px",
                boxShadow: "0 1px 2px rgba(15, 23, 42, 0.07)",
              },
              [`& .${chatMessageClasses.roleAssistant} .${chatMessageClasses.content}`]: {
                justifySelf: "start",
                alignItems: "flex-start",
              },
              [`& .${chatMessageClasses.roleUser} .${chatMessageClasses.authorLabel}`]: {
                alignSelf: "flex-end",
                color: "#64748b",
              },
              [`& .${chatMessageClasses.roleAssistant} .${chatMessageClasses.authorLabel}`]: {
                color: "#64748b",
              },
              [`& .${chatMessageClasses.inlineMeta}`]: { color: "#64748b", fontSize: "0.68rem" },
              [`& .${chatMessageClasses.dateDividerLabel}`]: {
                border: "1px solid #e2e8f0",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.92)",
                px: 1.25,
                py: 0.35,
                color: "#64748b",
                fontWeight: 700,
              },
              [`& .${chatComposerClasses.root}`]: {
                borderTop: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                padding: "12px 16px",
                gap: 1,
              },
              [`& .${chatComposerClasses.textArea}`]: {
                minHeight: 42,
                border: "1px solid #d6dde6",
                borderRadius: "12px",
                backgroundColor: "#ffffff",
                padding: "10px 12px",
                transition: "border-color 140ms ease, box-shadow 140ms ease",
                "&:focus": {
                  borderColor: "#e5b900",
                  boxShadow: "0 0 0 3px rgba(252, 206, 1, 0.18)",
                  outline: "none",
                },
              },
              [`& .${chatComposerClasses.sendButton}`]: {
                backgroundColor: "#fcce01",
                color: "#111827",
                borderRadius: "10px",
                width: 42,
                height: 42,
                "&:hover": { backgroundColor: "#e8bd00" },
                "&.Mui-disabled": { backgroundColor: "#e2e8f0", color: "#94a3b8" },
              },
              [`& .${chatComposerClasses.helperText}`]: { color: "#64748b", fontSize: "0.7rem" },
            }}
          />
        </Box>
        <AssignWhatsAppLeadModal
          open={assignLeadOpen}
          currentSellerId={selected?.lead?.assignedSellerId || null}
          onClose={() => setAssignLeadOpen(false)}
          onAssign={assignLead}
        />
        <FilePreviewModal
          file={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          getBlob={(file) => WhatsAppInboxService.attachmentBlob(file.id)}
          downloadFile={(file) => WhatsAppInboxService.downloadAttachment(file as WhatsAppInboundAttachment)}
        />
        <ConfirmWhatsAppQuoteExtractionModal
          attachment={quoteExtractionAttachment}
          processing={Boolean(generatingQuoteAttachmentId)}
          onClose={() => setQuoteExtractionAttachment(null)}
          onConfirm={() => {
            if (quoteExtractionAttachment) void generateQuoteFromAttachment(quoteExtractionAttachment);
          }}
        />
        <SelectClientModal
          open={convertLeadOpen}
          initialSearch={selected?.lead?.companyName || selected?.lead?.contactName || ""}
          localInitialValues={leadCustomerInitialValues}
          onClose={() => setConvertLeadOpen(false)}
          onSelect={(client) => void convertLeadAndOpenQuote(client)}
        />
        <Drawer
          anchor="right"
          open={prospectDrawerOpen && Boolean(selected?.lead)}
          onClose={() => setProspectDrawerOpen(false)}
          slotProps={{ backdrop: { sx: { backgroundColor: "rgba(15, 23, 42, 0.28)" } } }}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 420 },
              maxWidth: "100vw",
              bgcolor: "#f8fafc",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center" minWidth={0}>
              <Avatar variant="rounded" sx={{ width: 38, height: 38, bgcolor: "#fcce01", color: "#172033" }}>
                <Building2 size={19} />
              </Avatar>
              <Box minWidth={0}>
                <Typography variant="subtitle1" fontWeight={800}>Datos del prospecto</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {selected?.lead?.contactName || selected?.contactName || selected?.participantPhone || "Conversación seleccionada"}
                </Typography>
              </Box>
            </Stack>
            <IconButton aria-label="Cerrar datos del prospecto" onClick={() => setProspectDrawerOpen(false)}>
              <X size={19} />
            </IconButton>
          </Box>
          <Divider />
          {selected?.lead && (
            <Box sx={{ p: 2.5, overflowY: "auto", flex: 1 }}>
              <Stack spacing={2}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography variant="overline" fontWeight={800} color="text.secondary">Estado</Typography>
                  <Chip
                    size="small"
                    label={leadStatusLabel[selected.lead.status] || selected.lead.status}
                    sx={{
                      bgcolor: selected.lead.status === "ASSIGNED" || selected.lead.status === "CONVERTED" ? "#ecfdf5" : "#fff7cc",
                      color: selected.lead.status === "ASSIGNED" || selected.lead.status === "CONVERTED" ? "#047857" : "#7c5b00",
                    }}
                  />
                </Stack>

                <Paper variant="outlined" sx={{ p: 2, borderColor: "#dbe2ea", bgcolor: "#ffffff" }}>
                  <Typography variant="overline" fontWeight={800} color="text.secondary">Contacto</Typography>
                  <Typography variant="body1" fontWeight={800} sx={{ mt: 0.5 }}>
                    {selected.lead.contactName || selected.contactName || "Nombre pendiente"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                    {selected.lead.companyName || "Empresa no indicada"}
                  </Typography>
                  <Divider sx={{ my: 1.5 }} />
                  <Stack spacing={1}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MessageCircleMore size={15} color="#64748b" />
                      <Typography variant="body2">{selected.participantPhone}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Mail size={15} color="#64748b" />
                      <Typography variant="body2" color={selected.lead.email ? "text.primary" : "text.secondary"} sx={{ overflowWrap: "anywhere" }}>
                        {selected.lead.email || "Correo pendiente"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <MapPin size={15} color="#64748b" style={{ marginTop: 2, flexShrink: 0 }} />
                      <Typography variant="body2" color={selected.lead.location ? "text.primary" : "text.secondary"}>
                        {selected.lead.location || "Ubicación pendiente"}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderColor: "#dbe2ea", bgcolor: "#ffffff" }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <FileText size={16} color="#8a6a00" />
                    <Typography variant="overline" fontWeight={800} color="text.secondary">Solicitud</Typography>
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 1, whiteSpace: "pre-wrap", lineHeight: 1.65 }}>
                    {selected.lead.requestSummary || "La IA todavía está recopilando los materiales requeridos."}
                  </Typography>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderColor: "#dbe2ea", bgcolor: "#ffffff" }}>
                  <Typography variant="overline" fontWeight={800} color="text.secondary">Asignación</Typography>
                  <Stack spacing={1.1} sx={{ mt: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Vendedor</Typography>
                      <Typography variant="body2" fontWeight={700}>{selected.lead.assignedSellerName || "Sin vendedor asignado"}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Sucursal</Typography>
                      <Typography variant="body2" fontWeight={700}>{selected.lead.assignedBranchName || "Sin sucursal asignada"}</Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </Box>
          )}
        </Drawer>
        <Drawer
          anchor="right"
          open={quotesDrawerOpen}
          onClose={() => setQuotesDrawerOpen(false)}
          slotProps={{ backdrop: { sx: { backgroundColor: "rgba(15, 23, 42, 0.28)" } } }}
          PaperProps={{
            sx: {
              width: { xs: "100%", sm: 440 },
              maxWidth: "100vw",
              bgcolor: "#f8fafc",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 2 }}>
            <Stack direction="row" spacing={1.25} alignItems="center">
              <Avatar variant="rounded" sx={{ width: 38, height: 38, bgcolor: "#fcce01", color: "#172033" }}>
                <FileText size={19} />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Cotizaciones relacionadas</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selected?.customerName || selected?.contactName || "Conversación seleccionada"}
                </Typography>
              </Box>
            </Stack>
            <IconButton aria-label="Cerrar historial" onClick={() => setQuotesDrawerOpen(false)}>
              <X size={19} />
            </IconButton>
          </Box>
          <Divider />
          <Box sx={{ px: 2.5, py: 2, overflowY: "auto", flex: 1 }}>
            {relatedQuotesLoading ? (
              <Stack alignItems="center" justifyContent="center" spacing={1.25} sx={{ minHeight: 240 }}>
                <CircularProgress size={28} sx={{ color: "#d4a900" }} />
                <Typography variant="body2" color="text.secondary">Cargando cotizaciones...</Typography>
              </Stack>
            ) : relatedQuoteFamilies.length === 0 ? (
              <Paper variant="outlined" sx={{ p: 3, textAlign: "center", borderStyle: "dashed", bgcolor: "#ffffff" }}>
                <FileText size={28} color="#94a3b8" />
                <Typography variant="body2" fontWeight={700} sx={{ mt: 1 }}>Aún no hay cotizaciones relacionadas</Typography>
                <Typography variant="caption" color="text.secondary">Las cotizaciones del cliente aparecerán aquí.</Typography>
              </Paper>
            ) : (
              <Stack spacing={2.25}>
                {quoteSections.map((section) => {
                  const families = relatedQuoteFamilies.filter(({ primary }) => section.statuses.includes(primary.status as never));
                  if (families.length === 0) return null;
                  return (
                    <Box key={section.key}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="overline" fontWeight={800} color="text.secondary">{section.label}</Typography>
                        <Chip size="small" label={families.length} sx={{ height: 22, bgcolor: "#e2e8f0", color: "#475569" }} />
                      </Stack>
                      <Stack spacing={1}>
                        {families.map(({ primary, versions }) => (
                          <Paper key={primary.rootQuoteId || primary.id} variant="outlined" sx={{ overflow: "hidden", bgcolor: "#ffffff", borderColor: primary.isCurrent ? "#e5b900" : "#dbe2ea" }}>
                            <Button
                              component={NavLink}
                              to={`/quotes/${primary.id}`}
                              onClick={() => setQuotesDrawerOpen(false)}
                              fullWidth
                              sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, px: 1.5, py: 1.4, color: "#172033", textAlign: "left" }}
                            >
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                                  <Typography variant="body2" fontWeight={800}>{primary.quoteNumber}</Typography>
                                  {primary.isCurrent && <Chip size="small" label="Actual" sx={{ height: 20, bgcolor: "#fff3a3", color: "#6b5200" }} />}
                                  <Chip size="small" label={quoteStatusLabel[primary.status] || primary.status} sx={{ height: 20, ...(quoteStatusStyle[primary.status] || quoteStatusStyle.DRAFT) }} />
                                </Stack>
                                <Typography variant="body2" fontWeight={800} sx={{ mt: 0.75 }}>{formatQuoteTotal(primary)}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatQuoteDate(primary.updatedAt)} · {primary.sellerName}
                                  {versions.length > 1 ? ` · ${versions.length} versiones` : ""}
                                </Typography>
                              </Box>
                              <ChevronRight size={18} color="#64748b" />
                            </Button>
                            {versions.length > 1 && (
                              <Box sx={{ borderTop: "1px solid #edf1f5", px: 1.5, py: 1, bgcolor: "#fbfcfd" }}>
                                <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                                  {versions.map((version) => (
                                    <Button
                                      key={version.id}
                                      component={NavLink}
                                      to={`/quotes/${version.id}`}
                                      onClick={() => setQuotesDrawerOpen(false)}
                                      size="small"
                                      variant={version.id === primary.id ? "contained" : "outlined"}
                                      sx={version.id === primary.id
                                        ? { minWidth: 0, bgcolor: "#172033", color: "#ffffff", "&:hover": { bgcolor: "#273449" } }
                                        : { minWidth: 0, color: "#475569", borderColor: "#cbd5e1" }}
                                    >
                                      R{String(version.revisionNumber).padStart(2, "0")}
                                    </Button>
                                  ))}
                                </Stack>
                              </Box>
                            )}
                          </Paper>
                        ))}
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        </Drawer>
      </Paper>
    </ThemeProvider>
  );
};
