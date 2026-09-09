import { ChatBox, chatBoxClasses, chatComposerClasses, chatConversationListClasses, chatMessageClasses } from "@mui/x-chat";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { Bot, Clock3, ExternalLink, Headphones, MessageCircleMore, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router";
import { MuiWhatsAppChatAdapter } from "../../modules/whatsapp/adapters/mui-whatsapp-chat.adapter";
import {
  WhatsAppInboxService,
  type WhatsAppInboxConversation,
  type WhatsAppConversationMode,
} from "../../modules/whatsapp/services/whatsapp-inbox.service";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";

const chatTheme = createTheme({
  palette: {
    primary: { main: "#1f2937", contrastText: "#ffffff" },
    secondary: { main: "#fcce01", contrastText: "#111827" },
    background: { default: "#f8fafc", paper: "#ffffff" },
  },
  typography: {
    fontFamily: '"DM Sans", "Avenir Next", sans-serif',
    fontSize: 13,
  },
  shape: { borderRadius: 10 },
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

  const handleConversationData = useCallback((items: WhatsAppInboxConversation[]) => {
    setConversationData(items);
  }, []);

  const adapter = useMemo(
    () => new MuiWhatsAppChatAdapter(
      { id: user?.id || "current-user", displayName },
      handleConversationData,
    ),
    [displayName, handleConversationData, user?.id],
  );

  useEffect(() => () => adapter.stop(), [adapter]);

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
      <section className="flex h-[calc(100vh-7.5rem)] min-h-[560px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-[linear-gradient(110deg,#fff8cf_0%,#ffffff_48%,#f8fafc_100%)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#fcce01] text-slate-950 shadow-sm">
              <MessageCircleMore className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">Conversaciones de WhatsApp</h1>
              <p className="text-xs text-slate-500">
                {conversationData.length} conversaciones visibles según tus permisos
              </p>
            </div>
          </div>

          {selected ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
                windowActive
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}>
                <Clock3 className="h-3.5 w-3.5" />
                {windowActive ? "Ventana de 24 h activa" : "Fuera de ventana de 24 h"}
              </span>
              {selected.quote && (
                <NavLink
                  to={`/quotes/${selected.quote.id}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-400"
                >
                  {selected.quote.quoteNumber}
                  <ExternalLink className="h-3.5 w-3.5" />
                </NavLink>
              )}
              <button
                type="button"
                disabled={changingMode}
                onClick={() => void changeMode(selected.mode === "AI" ? "HUMAN" : "AI")}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                  selected.mode === "AI"
                    ? "bg-slate-900 text-white hover:bg-slate-800"
                    : "border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
                }`}
              >
                {selected.mode === "AI" ? <Headphones className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                {selected.mode === "AI" ? "Tomar conversación" : "Devolver a la IA"}
              </button>
            </div>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
              <ShieldCheck className="h-4 w-4 text-amber-500" />
              Selecciona una conversación para consultar su contexto.
            </span>
          )}
        </header>

        {selected && (
          <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-4 py-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              {initials(selected.contactName || selected.customerName)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-slate-800">{selected.contactName || selected.customerName}</p>
              <p className="truncate text-[11px] text-slate-500">
                {selected.customerName} · {selected.participantPhone}
                {selected.sellerName ? ` · Vendedor: ${selected.sellerName}` : ""}
              </p>
            </div>
            <span className={`ml-auto shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
              selected.mode === "AI" ? "bg-sky-50 text-sky-700" : "bg-amber-100 text-amber-900"
            }`}>
              {selected.mode === "AI" ? "Atiende IA" : `Atiende ${selected.handledByName || "usuario"}`}
            </span>
          </div>
        )}

        <div className="min-h-0 flex-1">
          <ChatBox
            adapter={adapter}
            currentUser={{ id: user?.id || "current-user", displayName, role: "user" }}
            members={[
              { id: user?.id || "current-user", displayName, role: "user" },
              { id: "tuvansa-ai", displayName: "Asistente Tuvansa", role: "user" },
            ]}
            onActiveConversationChange={(conversationId) => setActiveId(conversationId)}
            onError={(error) => notifier.error(error.message || "No se pudo completar la acción en WhatsApp.")}
            variant="compact"
            density="compact"
            features={{
              conversationList: true,
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
            slots={{ composerAttachButton: null }}
            slotProps={{
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
                width: { md: 340 },
                borderRight: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              },
              [`& .${chatBoxClasses.threadPane}`]: { backgroundColor: "#f8fafc" },
              [`& .${chatConversationListClasses.item}`]: {
                borderRadius: "10px",
                margin: "3px 8px",
                width: "calc(100% - 16px)",
              },
              [`& .${chatConversationListClasses.itemSelected}`]: {
                backgroundColor: "#fff7cc",
              },
              [`& .${chatConversationListClasses.itemUnreadBadge}`]: {
                backgroundColor: "#fcce01",
                color: "#111827",
              },
              [`& .${chatMessageClasses.roleUser} .${chatMessageClasses.bubble}`]: {
                backgroundColor: "#fff0a8",
                color: "#1f2937",
                border: "1px solid #f4d95d",
              },
              [`& .${chatMessageClasses.roleAssistant} .${chatMessageClasses.bubble}`]: {
                backgroundColor: "#ffffff",
                color: "#334155",
                border: "1px solid #e2e8f0",
              },
              [`& .${chatComposerClasses.root}`]: {
                borderTop: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
              },
              [`& .${chatComposerClasses.sendButton}`]: {
                backgroundColor: "#fcce01",
                color: "#111827",
              },
            }}
          />
        </div>
      </section>
    </ThemeProvider>
  );
};
