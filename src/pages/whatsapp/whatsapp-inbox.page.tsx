import {
  ChatBox,
  chatBoxClasses,
  chatComposerClasses,
  chatConversationListClasses,
  chatMessageClasses,
  chatMessageListClasses,
} from "@mui/x-chat";
import { Avatar, Box, Button, Chip, CircularProgress, Paper, Stack, Typography } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ChatMessage } from "@mui/x-chat-headless";
import { Bot, Clock3, ExternalLink, Headphones, MessageCircleMore, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router";
import { MuiWhatsAppChatAdapter } from "../../modules/whatsapp/adapters/mui-whatsapp-chat.adapter";
import type { WhatsAppRealtimeStatus } from "../../modules/whatsapp/services/whatsapp-realtime.service";
import {
  WhatsAppInboxService,
  type WhatsAppInboxConversation,
  type WhatsAppConversationMode,
} from "../../modules/whatsapp/services/whatsapp-inbox.service";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

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

export const WhatsAppInboxPage = () => {
  const user = useAuthStore((state) => state.user);
  const displayName = `${user?.name || ""} ${user?.lastname || ""}`.trim() || "Usuario Tuvansa";
  const [conversationData, setConversationData] = useState<WhatsAppInboxConversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [selected, setSelected] = useState<WhatsAppInboxConversation>();
  const [changingMode, setChangingMode] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [realtimeStatus, setRealtimeStatus] = useState<WhatsAppRealtimeStatus>("connecting");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
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

  const windowActive = isWindowActive(selected?.lastInboundAt || null, now);
  const canReply = Boolean(selected && selected.mode === "HUMAN" && windowActive);

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
      </Paper>
    </ThemeProvider>
  );
};
