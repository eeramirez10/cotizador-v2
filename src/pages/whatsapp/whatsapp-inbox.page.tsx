import {
  ChatBox,
  ChatConversationList,
  chatBoxClasses,
  chatComposerClasses,
  chatConversationClasses,
  chatConversationListClasses,
  chatMessageClasses,
  chatMessageListClasses,
} from "@mui/x-chat";
import type { ChatConversationListProps } from "@mui/x-chat";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import BusinessIcon from "@mui/icons-material/Business";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import GppGoodOutlinedIcon from "@mui/icons-material/GppGoodOutlined";
import HeadsetMicOutlinedIcon from "@mui/icons-material/HeadsetMicOutlined";
import HistoryIcon from "@mui/icons-material/History";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import NoteAddOutlinedIcon from "@mui/icons-material/NoteAddOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import SearchIcon from "@mui/icons-material/Search";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import { Avatar, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, IconButton, InputAdornment, ListItemIcon, Menu, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ChatMessage, ConversationListItemAvatarProps } from "@mui/x-chat-headless";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useSearchParams } from "react-router";
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
        root: { textTransform: "none", fontWeight: 600 },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600 },
      },
    },
  },
});

const isWindowActive = (lastInboundAt: string | null, now: number): boolean =>
  Boolean(lastInboundAt && Date.parse(lastInboundAt) + 24 * 60 * 60 * 1000 > now);

const initials = (value: string): string =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

const ConversationInitialsAvatar = forwardRef<HTMLDivElement, ConversationListItemAvatarProps>(
  function ConversationInitialsAvatar(props, ref) {
    const participant = props.conversation.participants?.find((item) => item.role !== "user")
      || props.conversation.participants?.[0];
    const label = participant?.displayName || props.conversation.title || "Cliente";
    return (
      <Box
        ref={ref}
        className={props.className}
        style={props.style}
        aria-label={label}
        sx={{
          width: 40,
          height: 40,
          minWidth: 40,
          p: 0.5,
          display: "grid",
          placeItems: "center",
          borderRadius: "50%",
          boxSizing: "border-box",
          bgcolor: "#fcce01",
          color: "#172033",
          fontSize: "0.75rem",
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {initials(label)}
      </Box>
    );
  },
);

type ConversationFilter = "ALL" | "UNREAD" | "PROSPECTS";

interface WhatsAppConversationListPanelProps extends ChatConversationListProps {
  searchValue?: string;
  activeFilter?: ConversationFilter;
  visibleConversationIds?: string[];
  emptyLabel?: string;
  canDeleteConversations?: boolean;
  deletingConversationId?: string | null;
  onSearchValueChange?: (value: string) => void;
  onFilterChange?: (value: ConversationFilter) => void;
  onDeleteConversation?: (conversationId: string) => void;
}

const WhatsAppConversationListPanel = forwardRef<HTMLDivElement, WhatsAppConversationListPanelProps>(
  function WhatsAppConversationListPanel(
    {
      searchValue = "",
      activeFilter = "ALL",
      visibleConversationIds = [],
      emptyLabel = "No hay conversaciones para mostrar.",
      canDeleteConversations = false,
      deletingConversationId = null,
      onSearchValueChange,
      onFilterChange,
      onDeleteConversation,
      sx,
      slotProps,
      ...listProps
    },
    ref,
  ) {
    const visibleIds = useMemo(() => new Set(visibleConversationIds), [visibleConversationIds]);
    const hasVisibleConversations = visibleConversationIds.length > 0;
    const [contextMenu, setContextMenu] = useState<{
      conversationId: string;
      mouseX: number;
      mouseY: number;
    } | null>(null);
    const filters: Array<{ value: ConversationFilter; label: string }> = [
      { value: "ALL", label: "Todos" },
      { value: "UNREAD", label: "No leídos" },
      { value: "PROSPECTS", label: "Prospectos" },
    ];

    return (
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, bgcolor: "#ffffff" }}>
        <Box sx={{ px: 2, pt: 1.75, pb: 1.25, borderBottom: "1px solid #eef1f5" }}>
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1.25 }}>
            Mensajes
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={searchValue}
            onChange={(event) => onSearchValueChange?.(event.target.value)}
            placeholder="Buscar conversación"
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 17, color: "#64748b" }} />
                  </InputAdornment>
                ),
              },
            }}
            sx={{
              "& .MuiOutlinedInput-root": {
                borderRadius: 999,
                bgcolor: "#f6f7f9",
                fontSize: "0.82rem",
                "& fieldset": { borderColor: "transparent" },
                "&:hover fieldset": { borderColor: "#d8dee7" },
                "&.Mui-focused fieldset": { borderColor: "#d4a900" },
              },
            }}
          />
          <Stack direction="row" spacing={0.75} sx={{ mt: 1.25 }}>
            {filters.map((filter) => {
              const selected = activeFilter === filter.value;
              return (
                <Button
                  key={filter.value}
                  type="button"
                  size="small"
                  variant={selected ? "contained" : "outlined"}
                  onClick={() => onFilterChange?.(filter.value)}
                  sx={{
                    minWidth: 0,
                    px: 1.25,
                    borderRadius: 999,
                    bgcolor: selected ? "#172033" : "#ffffff",
                    color: selected ? "#ffffff" : "#475569",
                    borderColor: selected ? "#172033" : "#d7dde5",
                    fontSize: "0.72rem",
                    "&:hover": {
                      bgcolor: selected ? "#0f172a" : "#f8fafc",
                      borderColor: selected ? "#0f172a" : "#c5cdd8",
                    },
                  }}
                >
                  {filter.label}
                </Button>
              );
            })}
          </Stack>
        </Box>
        <Box sx={{ position: "relative", flex: 1, minHeight: 0 }}>
          <ChatConversationList
            ref={ref}
            {...listProps}
            slotProps={{
              ...slotProps,
              item: (ownerState) => {
                const inheritedProps = typeof slotProps?.item === "function"
                  ? slotProps.item(ownerState)
                  : slotProps?.item;
                return {
                  ...inheritedProps,
                  onContextMenu: (event) => {
                    inheritedProps?.onContextMenu?.(event);
                    if (event.defaultPrevented || !canDeleteConversations) return;
                    event.preventDefault();
                    setContextMenu({
                      conversationId: ownerState.conversation.id,
                      mouseX: event.clientX + 2,
                      mouseY: event.clientY - 6,
                    });
                  },
                  style: {
                    ...inheritedProps?.style,
                    display: visibleIds.has(ownerState.conversation.id) ? undefined : "none",
                  },
                };
              },
            }}
            sx={[
              { height: "100%", minHeight: 0 },
              ...(Array.isArray(sx) ? sx : [sx]),
            ]}
          />
          {!hasVisibleConversations && (
            <Stack
              alignItems="center"
              justifyContent="center"
              spacing={0.5}
              sx={{ position: "absolute", inset: 0, px: 3, textAlign: "center", pointerEvents: "none" }}
            >
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {emptyLabel}
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Cambia el filtro para consultar otras conversaciones.
              </Typography>
            </Stack>
          )}
          {canDeleteConversations && (
            <Menu
              open={Boolean(contextMenu)}
              onClose={() => setContextMenu(null)}
              anchorReference="anchorPosition"
              anchorPosition={contextMenu
                ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                : undefined}
              slotProps={{
                paper: {
                  sx: {
                    minWidth: 190,
                    borderRadius: 2,
                    boxShadow: "0 14px 34px rgba(15, 23, 42, 0.16)",
                  },
                },
              }}
            >
              <MenuItem
                disabled={!contextMenu || deletingConversationId === contextMenu.conversationId}
                onClick={() => {
                  if (!contextMenu) return;
                  const conversationId = contextMenu.conversationId;
                  setContextMenu(null);
                  onDeleteConversation?.(conversationId);
                }}
                sx={{ color: "error.main", fontSize: "0.82rem" }}
              >
                <ListItemIcon sx={{ color: "error.main", minWidth: "32px !important" }}>
                  <DeleteOutlineIcon fontSize="small" />
                </ListItemIcon>
                Eliminar conversación
              </MenuItem>
            </Menu>
          )}
        </Box>
      </Box>
    );
  },
);

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
  const [searchParams, setSearchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const quoteDraft = useManualQuoteStore((state) => state.draft);
  const clearQuoteDraft = useManualQuoteStore((state) => state.clearDraft);
  const initializeQuoteDraft = useManualQuoteStore((state) => state.initializeDraft);
  const setQuoteClient = useManualQuoteStore((state) => state.setClient);
  const setQuoteSourceChannel = useManualQuoteStore((state) => state.setSourceChannel);
  const setQuoteWhatsAppLeadId = useManualQuoteStore((state) => state.setWhatsAppLeadId);
  const setItemsFromExtraction = useManualQuoteStore((state) => state.setItemsFromExtraction);
  const displayName = `${user?.name || ""} ${user?.lastname || ""}`.trim() || "Usuario Tuvansa";
  const canDeleteConversations = user?.role?.trim().toLowerCase() === "admin";
  const [conversationData, setConversationData] = useState<WhatsAppInboxConversation[]>([]);
  const [conversationSearch, setConversationSearch] = useState("");
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("ALL");
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
  const [pendingLinkAttachment, setPendingLinkAttachment] = useState<WhatsAppInboundAttachment | null>(null);
  const [linkBeforeExtractionOpen, setLinkBeforeExtractionOpen] = useState(false);
  const [generatingQuoteAttachmentId, setGeneratingQuoteAttachmentId] = useState<string | null>(null);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [deletingConversationId, setDeletingConversationId] = useState<string | null>(null);
  const activeIdRef = useRef<string | undefined>(undefined);
  const lastConversationSearchRef = useRef("");
  const markingReadRef = useRef(new Set<string>());

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

  const markConversationRead = useCallback(async (
    conversationId: string,
    conversation?: WhatsAppInboxConversation,
  ): Promise<void> => {
    const current = conversation || adapter.getConversation(conversationId);
    if (!current || current.unreadCount <= 0 || markingReadRef.current.has(conversationId)) return;
    markingReadRef.current.add(conversationId);
    try {
      await adapter.markRead({ conversationId });
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo marcar la conversación como leída.");
    } finally {
      markingReadRef.current.delete(conversationId);
    }
  }, [adapter]);

  useEffect(() => {
    const requestedConversationId = searchParams.get("conversation")?.trim();
    if (!requestedConversationId || activeIdRef.current === requestedConversationId) return;
    void WhatsAppInboxService.get(requestedConversationId)
      .then((conversation) => {
        adapter.updateConversation(conversation);
        activeIdRef.current = conversation.id;
        setActiveId(conversation.id);
        setSelected(conversation);
        setMessages([]);
        void markConversationRead(conversation.id, conversation);
      })
      .catch(() => undefined);
  }, [adapter, markConversationRead, searchParams]);

  useEffect(() => {
    const query = conversationSearch.trim();
    if (query === lastConversationSearchRef.current) return;
    const timeout = window.setTimeout(() => {
      lastConversationSearchRef.current = query;
      void adapter.listConversations({ query }).catch((error) => {
        notifier.error(error instanceof Error ? error.message : "No se pudieron buscar conversaciones.");
      });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [adapter, conversationSearch]);

  const chatConversations = useMemo(
    () => conversationData.map((conversation) => adapter.toChatConversation(conversation)),
    [adapter, conversationData],
  );

  const visibleConversationIds = useMemo(() => {
    const query = conversationSearch.trim().toLocaleLowerCase("es-MX");
    return conversationData
      .filter((conversation) => {
        if (conversationFilter === "UNREAD" && conversation.unreadCount === 0) return false;
        if (conversationFilter === "PROSPECTS" && !conversation.lead) return false;
        if (!query) return true;
        return [
          conversation.contactName,
          conversation.customerName,
          conversation.participantPhone,
          conversation.lastMessage,
          conversation.quote?.quoteNumber,
        ].some((value) => value?.toLocaleLowerCase("es-MX").includes(query));
      })
      .map((conversation) => conversation.id);
  }, [conversationData, conversationFilter, conversationSearch]);

  const emptyConversationLabel = conversationFilter === "UNREAD"
    ? "No hay conversaciones sin leer."
    : conversationFilter === "PROSPECTS"
      ? "No hay conversaciones de prospectos."
      : "No hay conversaciones para mostrar.";

  const deleteCandidate = deleteConversationId
    ? conversationData.find((conversation) => conversation.id === deleteConversationId) || null
    : null;

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
    if (cached) {
      setSelected(cached);
      void markConversationRead(activeId, cached);
    }
    void WhatsAppInboxService.get(activeId)
      .then((result) => {
        adapter.updateConversation(result);
        setSelected(result);
        void markConversationRead(activeId, result);
      })
      .catch(() => undefined);
  }, [activeId, adapter, markConversationRead]);

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
    setPendingLinkAttachment(null);
    setLinkBeforeExtractionOpen(false);
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

  const generateQuoteFromAttachment = async (
    attachment: WhatsAppInboundAttachment,
    linkedCustomer?: Client,
  ) => {
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
      let customer: Client | null = linkedCustomer || null;
      const linkedCustomerId = selected.customerId || selected.lead?.customerId;
      if (!customer && linkedCustomerId) {
        const loaded = await CustomersService.getById(linkedCustomerId);
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

  const requestQuoteExtraction = (attachment: WhatsAppInboundAttachment): void => {
    if (!selected) return;
    const linkedCustomerId = selected.customerId || selected.lead?.customerId;
    if (linkedCustomerId) {
      void generateQuoteFromAttachment(attachment);
      return;
    }
    if (!selected.lead) {
      notifier.warning("La conversación no tiene un prospecto que se pueda vincular.");
      return;
    }
    setQuoteExtractionAttachment(null);
    setPendingLinkAttachment(attachment);
    setLinkBeforeExtractionOpen(true);
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
    const attachmentToProcess = pendingLinkAttachment;
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
      const linkedClient = clientWithSelectedContact(customer, contact);
      setPendingLinkAttachment(null);
      if (attachmentToProcess) {
        if (toastId !== undefined) notifier.update(toastId, "success", "Cliente vinculado. Iniciando extracción del archivo...");
        else notifier.success("Cliente vinculado. Iniciando extracción del archivo...");
        await generateQuoteFromAttachment(attachmentToProcess, linkedClient);
      } else {
        if (toastId !== undefined) notifier.update(toastId, "success", "Prospecto convertido en cliente.");
        else notifier.success("Prospecto convertido en cliente.");
        openQuoteForLead(linkedClient, selected.lead.id);
      }
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

  const deleteConversation = async (): Promise<void> => {
    if (!canDeleteConversations || !deleteCandidate || deletingConversationId) return;
    const conversationId = deleteCandidate.id;
    setDeletingConversationId(conversationId);
    const toastId = notifier.loading("Eliminando conversación y archivos temporales...");
    try {
      const result = await WhatsAppInboxService.deleteConversation(conversationId);
      adapter.removeConversation(conversationId);
      if (activeIdRef.current === conversationId) {
        activeIdRef.current = undefined;
        adapter.setActiveConversation(undefined);
        setActiveId(undefined);
        setSelected(undefined);
        setMessages([]);
        const nextParams = new URLSearchParams(searchParams);
        nextParams.delete("conversation");
        setSearchParams(nextParams, { replace: true });
      }
      setDeleteConversationId(null);
      const preserved = result.preservedQuoteCount > 0
        ? ` Se conservaron ${result.preservedQuoteCount} cotización${result.preservedQuoteCount === 1 ? "" : "es"}.`
        : "";
      const message = result.failedFileCount > 0
        ? `La conversación se eliminó, pero ${result.failedFileCount} archivo${result.failedFileCount === 1 ? "" : "s"} no se pudieron limpiar.${preserved}`
        : `Conversación eliminada.${preserved}`;
      if (toastId !== undefined) {
        notifier.update(toastId, result.failedFileCount > 0 ? "warning" : "success", message);
      } else if (result.failedFileCount > 0) notifier.warning(message);
      else notifier.success(message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo eliminar la conversación.";
      if (toastId !== undefined) notifier.update(toastId, "error", message);
      else notifier.error(message);
    } finally {
      setDeletingConversationId(null);
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
              <WhatsAppIcon sx={{ fontSize: 21 }} />
            </Avatar>
            <Box>
              <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
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
                icon={<AccessTimeIcon sx={{ fontSize: 15 }} />}
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
                  endIcon={<OpenInNewIcon sx={{ fontSize: 15 }} />}
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
                  startIcon={<BusinessIcon sx={{ fontSize: 15 }} />}
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
                startIcon={<HistoryIcon sx={{ fontSize: 15 }} />}
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
                  startIcon={assigningLead ? <CircularProgress size={14} color="inherit" /> : <PersonAddAlt1Icon sx={{ fontSize: 15 }} />}
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
                  startIcon={convertingLead ? <CircularProgress size={14} color="inherit" /> : <NoteAddOutlinedIcon sx={{ fontSize: 15 }} />}
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
                    ? <HeadsetMicOutlinedIcon sx={{ fontSize: 15 }} />
                    : <SmartToyOutlinedIcon sx={{ fontSize: 15 }} />}
                sx={selected.mode === "HUMAN" ? { borderColor: "#e5b900", bgcolor: "#fffbea" } : undefined}
              >
                {selected.mode === "AI" ? "Tomar conversación" : "Devolver a la IA"}
              </Button>
            </Stack>
          ) : (
            <Stack direction="row" alignItems="center" spacing={0.75} color="text.secondary">
              <GppGoodOutlinedIcon sx={{ fontSize: 17, color: "#d4a900" }} />
              <Typography variant="caption" fontWeight={500}>
                Selecciona una conversación para consultar su contexto.
              </Typography>
            </Stack>
          )}
        </Box>

        <Box sx={{ minHeight: 0, flex: 1 }}>
          <ChatBox
            adapter={adapter}
            conversations={chatConversations}
            activeConversationId={activeId}
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
              if (conversationId) void markConversationRead(conversationId);
            }}
            onError={(error) => notifier.error(error.message || "No se pudo completar la acción en WhatsApp.")}
            variant="default"
            density="compact"
            features={{
              conversationList: true,
              conversationHeader: true,
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
            slots={{
              conversationList: WhatsAppConversationListPanel,
              composerAttachButton: null,
              messageAvatar: null,
            }}
            slotProps={{
              conversationList: {
                slots: { itemAvatar: ConversationInitialsAvatar },
                searchValue: conversationSearch,
                activeFilter: conversationFilter,
                visibleConversationIds,
                emptyLabel: emptyConversationLabel,
                canDeleteConversations,
                deletingConversationId,
                onSearchValueChange: setConversationSearch,
                onFilterChange: setConversationFilter,
                onDeleteConversation: canDeleteConversations ? setDeleteConversationId : undefined,
              } as WhatsAppConversationListPanelProps,
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
                "--ChatBox-conversationListWidth": "320px",
                borderRight: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              },
              [`& .${chatBoxClasses.threadPane}`]: {
                backgroundColor: "#ffffff",
              },
              [`& .${chatConversationClasses.header}`]: {
                minHeight: 64,
                px: 2,
                py: 1.15,
                borderBottom: "1px solid #e5e7eb",
                backgroundColor: "#ffffff",
              },
              [`& .${chatConversationClasses.title}`]: { color: "#172033", fontWeight: 650 },
              [`& .${chatConversationClasses.subtitle}`]: { color: "#7b8492", fontSize: "0.74rem" },
              [`& .${chatConversationListClasses.root}`]: { bgcolor: "#ffffff" },
              [`& .${chatConversationListClasses.scroller}`]: { px: 0.5, py: 0.75 },
              [`& .${chatConversationListClasses.item}`]: {
                borderRadius: "12px",
                margin: "3px 6px",
                width: "calc(100% - 12px)",
                minHeight: 68,
                transition: "background-color 140ms ease",
                [`&:not(.${chatConversationListClasses.itemSelected}):hover`]: {
                  backgroundColor: "#f8fafc",
                },
              },
              [`& .${chatConversationListClasses.itemSelected}`]: {
                backgroundColor: "#f1f3f5 !important",
                boxShadow: "none",
                transform: "none",
              },
              [`& .${chatConversationListClasses.itemAvatar}`]: {
                bgcolor: "#fcce01",
                color: "#172033",
                fontWeight: 700,
              },
              [`& .${chatConversationListClasses.itemTitle}`]: { color: "#172033", fontWeight: 650 },
              [`& .${chatConversationListClasses.itemPreview}`]: { color: "#64748b" },
              [`& .${chatConversationListClasses.itemUnreadBadge}`]: {
                backgroundColor: "#fcce01",
                color: "#111827",
              },
              [`& .${chatMessageListClasses.scroller}`]: { px: { xs: 1.25, md: 2.5 }, py: 1.5 },
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
                fontWeight: 600,
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
        <Dialog
          open={Boolean(deleteCandidate)}
          onClose={() => { if (!deletingConversationId) setDeleteConversationId(null); }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle sx={{ pb: 1 }}>Eliminar conversación</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25}>
              <Typography variant="body2">
                ¿Deseas eliminar permanentemente el chat con <strong>{deleteCandidate?.contactName || deleteCandidate?.customerName}</strong>?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Se eliminarán sus mensajes y archivos temporales. El cliente, sus contactos, las cotizaciones y los documentos usados para generarlas se conservarán.
              </Typography>
              {deleteCandidate?.lead && !deleteCandidate.lead.customerId && (
                <Typography variant="body2" color="warning.dark">
                  Como es un prospecto sin convertir, también se eliminarán sus datos provisionales y asignaciones.
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              type="button"
              variant="outlined"
              disabled={Boolean(deletingConversationId)}
              onClick={() => setDeleteConversationId(null)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              color="error"
              variant="contained"
              disabled={Boolean(deletingConversationId)}
              onClick={() => void deleteConversation()}
              startIcon={deletingConversationId
                ? <CircularProgress size={15} color="inherit" />
                : <DeleteOutlineIcon />}
            >
              Eliminar conversación
            </Button>
          </DialogActions>
        </Dialog>
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
            if (quoteExtractionAttachment) requestQuoteExtraction(quoteExtractionAttachment);
          }}
        />
        <Dialog
          open={linkBeforeExtractionOpen && Boolean(pendingLinkAttachment)}
          onClose={() => {
            setLinkBeforeExtractionOpen(false);
            setPendingLinkAttachment(null);
          }}
          fullWidth
          maxWidth="xs"
          PaperProps={{ sx: { borderRadius: 2.5 } }}
        >
          <DialogTitle sx={{ pb: 1 }}>Vincular prospecto antes de cotizar</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25}>
              <Typography variant="body2">
                Este contacto todavía no está vinculado con un cliente. ¿Deseas vincularlo antes de procesar <strong>{pendingLinkAttachment?.originalName}</strong>?
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Así el borrador conservará el cliente, su contacto y las partidas extraídas del archivo.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button
              type="button"
              color="inherit"
              onClick={() => {
                setLinkBeforeExtractionOpen(false);
                setPendingLinkAttachment(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="contained"
              startIcon={<PersonAddAlt1Icon />}
              onClick={() => {
                setLinkBeforeExtractionOpen(false);
                setConvertLeadOpen(true);
              }}
              sx={{ bgcolor: "#172033", "&:hover": { bgcolor: "#0f172a" } }}
            >
              Vincular cliente
            </Button>
          </DialogActions>
        </Dialog>
        <SelectClientModal
          open={convertLeadOpen}
          initialSearch={selected?.lead?.companyName || selected?.lead?.contactName || ""}
          localInitialValues={leadCustomerInitialValues}
          onClose={() => {
            setConvertLeadOpen(false);
            setPendingLinkAttachment(null);
          }}
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
                <BusinessIcon sx={{ fontSize: 19 }} />
              </Avatar>
              <Box minWidth={0}>
                <Typography variant="subtitle1" fontWeight={800}>Datos del prospecto</Typography>
                <Typography variant="caption" color="text.secondary" noWrap component="p">
                  {selected?.lead?.contactName || selected?.contactName || selected?.participantPhone || "Conversación seleccionada"}
                </Typography>
              </Box>
            </Stack>
            <IconButton aria-label="Cerrar datos del prospecto" onClick={() => setProspectDrawerOpen(false)}>
              <CloseIcon sx={{ fontSize: 19 }} />
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
                      <WhatsAppIcon sx={{ fontSize: 15, color: "#64748b" }} />
                      <Typography variant="body2">{selected.participantPhone}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <MailOutlineIcon sx={{ fontSize: 15, color: "#64748b" }} />
                      <Typography variant="body2" color={selected.lead.email ? "text.primary" : "text.secondary"} sx={{ overflowWrap: "anywhere" }}>
                        {selected.lead.email || "Correo pendiente"}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="flex-start">
                      <LocationOnOutlinedIcon sx={{ fontSize: 15, color: "#64748b", mt: "2px", flexShrink: 0 }} />
                      <Typography variant="body2" color={selected.lead.location ? "text.primary" : "text.secondary"}>
                        {selected.lead.location || "Ubicación pendiente"}
                      </Typography>
                    </Stack>
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2, borderColor: "#dbe2ea", bgcolor: "#ffffff" }}>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <DescriptionOutlinedIcon sx={{ fontSize: 16, color: "#8a6a00" }} />
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
                <DescriptionOutlinedIcon sx={{ fontSize: 19 }} />
              </Avatar>
              <Box>
                <Typography variant="subtitle1" fontWeight={800}>Cotizaciones relacionadas</Typography>
                <Typography variant="caption" color="text.secondary">
                  {selected?.customerName || selected?.contactName || "Conversación seleccionada"}
                </Typography>
              </Box>
            </Stack>
            <IconButton aria-label="Cerrar historial" onClick={() => setQuotesDrawerOpen(false)}>
              <CloseIcon sx={{ fontSize: 19 }} />
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
                <DescriptionOutlinedIcon sx={{ fontSize: 28, color: "#94a3b8" }} />
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
                              <ChevronRightIcon sx={{ fontSize: 18, color: "#64748b" }} />
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
