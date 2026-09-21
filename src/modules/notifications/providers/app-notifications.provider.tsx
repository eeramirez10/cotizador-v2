import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { useSystemCapabilities } from "../../../queries/system/use-system-capabilities";
import { useNavigate } from "react-router";
import { notifier } from "../../../shared/notifications/notifier";
import { useAuthStore } from "../../../store/auth/auth.store";
import {
  WhatsAppInboxService,
  type WhatsAppInboxConversation,
} from "../../whatsapp/services/whatsapp-inbox.service";
import {
  WhatsAppRealtimeClient,
  type WhatsAppRealtimeEvent,
  type WhatsAppRealtimeStatus,
} from "../../whatsapp/services/whatsapp-realtime.service";
import { AppNotificationsContext } from "../context/app-notifications.context";
import type { AppNotification } from "../types/app-notification.types";

const toNotification = (conversation: WhatsAppInboxConversation): AppNotification => ({
  id: `whatsapp-${conversation.id}`,
  source: "WHATSAPP",
  sourceId: conversation.id,
  kind: "MESSAGE",
  title: conversation.contactName || conversation.customerName || conversation.participantPhone,
  message: conversation.lastMessage || "Mensaje recibido",
  occurredAt: conversation.lastMessageAt,
  unreadCount: conversation.unreadCount,
  href: `/whatsapp?conversation=${encodeURIComponent(conversation.id)}`,
});

const quoteDecisionCopy = (status: "APPROVED" | "REJECTED" | "CANCELLED") => {
  if (status === "APPROVED") {
    return { kind: "QUOTE_ACCEPTED" as const, title: "Cotización aceptada", verb: "aceptó" };
  }
  if (status === "REJECTED") {
    return { kind: "QUOTE_REJECTED" as const, title: "Cotización no aceptada", verb: "no aceptó" };
  }
  return { kind: "QUOTE_CANCELLED" as const, title: "Cotización cancelada", verb: "canceló" };
};

const toQuoteDecisionNotification = (event: WhatsAppRealtimeEvent): AppNotification | null => {
  const quote = event.quoteDecision;
  if (!quote) return null;
  const copy = quoteDecisionCopy(quote.status);
  const contact = quote.contactName?.trim() || quote.customerName?.trim() || "El cliente";
  return {
    id: `quote-decision-${quote.quoteId}-${quote.status}-${event.occurredAt}`,
    source: "QUOTE",
    sourceId: quote.quoteId,
    kind: copy.kind,
    title: copy.title,
    message: `${contact} ${copy.verb} la cotización ${quote.quoteNumber}.`,
    occurredAt: event.occurredAt,
    unreadCount: 1,
    href: `/quotes/${encodeURIComponent(quote.quoteId)}`,
  };
};

const toCustomerRequestNotification = (event: WhatsAppRealtimeEvent): AppNotification | null => {
  const request = event.customerRequest;
  if (!request) return null;
  const information = request.requestType === "INFORMATION";
  return {
    id: `customer-request-${request.requestId}`,
    source: "QUOTE",
    sourceId: request.quoteId,
    kind: information ? "CUSTOMER_INFORMATION_REQUESTED" : "CUSTOMER_CHANGE_REQUESTED",
    title: information ? "Solicitud de información" : "Solicitud de modificación",
    message: `${request.quoteNumber}: ${request.detail}`,
    occurredAt: event.occurredAt,
    unreadCount: 1,
    href: `/quotes/${encodeURIComponent(request.quoteId)}`,
  };
};

const mergeConversation = (
  current: WhatsAppInboxConversation[],
  incoming: WhatsAppInboxConversation,
): WhatsAppInboxConversation[] => {
  const byId = new Map(current.map((conversation) => [conversation.id, conversation]));
  byId.set(incoming.id, incoming);
  return [...byId.values()]
    .sort((left, right) => Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt))
    .slice(0, 50);
};

export const AppNotificationsProvider = ({ children }: PropsWithChildren) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const capabilities = useSystemCapabilities();
  const [conversations, setConversations] = useState<WhatsAppInboxConversation[]>([]);
  const [quoteNotifications, setQuoteNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<WhatsAppRealtimeStatus>("disconnected");
  const role = (user?.role || "").trim().toLowerCase();
  const enabled = capabilities.data?.whatsAppInboxEnabled === true
    && ["admin", "manager", "seller"].includes(role);

  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    setLoading(true);
    try {
      const result = await WhatsAppInboxService.list({ pageSize: 50 });
      setConversations(result.items);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      setConversations([]);
      setQuoteNotifications([]);
      setRealtimeStatus("disconnected");
      return undefined;
    }

    let active = true;
    const syncConversation = async (event: WhatsAppRealtimeEvent): Promise<void> => {
      if (event.type === "QUOTE_CUSTOMER_DECISION") {
        const notification = toQuoteDecisionNotification(event);
        if (!notification) return;
        setQuoteNotifications((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, 20));
        const level = event.quoteDecision?.status === "APPROVED"
          ? "success"
          : event.quoteDecision?.status === "REJECTED"
            ? "warning"
            : "error";
        notifier[level](notification.message, {
          id: notification.id,
          durationMs: 8_000,
          presentation: {
            variant: "quote-decision",
            title: notification.title,
            occurredAt: event.occurredAt,
            tone: level,
          },
          action: {
            label: "Ver cotización",
            onClick: () => {
              setQuoteNotifications((current) => current.map((item) => item.id === notification.id
                ? { ...item, unreadCount: 0 }
                : item));
              navigate(notification.href);
            },
          },
        });
        return;
      }
      if (event.type === "QUOTE_CUSTOMER_REQUEST") {
        const notification = toCustomerRequestNotification(event);
        if (!notification) return;
        setQuoteNotifications((current) => [
          notification,
          ...current.filter((item) => item.id !== notification.id),
        ].slice(0, 20));
        notifier.info(notification.message, {
          id: notification.id,
          durationMs: 8_000,
          presentation: {
            variant: "quote-decision",
            title: notification.title,
            occurredAt: event.occurredAt,
            tone: "info",
          },
          action: {
            label: "Ver cotización",
            onClick: () => {
              setQuoteNotifications((current) => current.map((item) => item.id === notification.id
                ? { ...item, unreadCount: 0 }
                : item));
              navigate(notification.href);
            },
          },
        });
        return;
      }
      if (event.reason === "CONVERSATION_DELETED" || event.deleted) {
        setConversations((current) => current.filter(
          (conversation) => conversation.id !== event.conversationId,
        ));
        return;
      }
      try {
        const conversation = await WhatsAppInboxService.get(event.conversationId);
        if (!active) return;
        setConversations((current) => mergeConversation(current, conversation));

        if (event.reason === "MESSAGE_STATUS_CHANGED" && event.messagePatch?.status === "FAILED") {
          const failureMessage = event.messagePatch.errorMessage
            || "WhatsApp no pudo entregar el mensaje o descargar el archivo adjunto.";
          notifier.error(failureMessage, {
            id: `whatsapp-delivery-failed-${event.messagePatch.id}`,
            durationMs: 12_000,
            presentation: {
              variant: "whatsapp-message",
              title: "Falló el envío por WhatsApp",
              occurredAt: event.occurredAt,
              tone: "error",
            },
            action: {
              label: "Abrir chat",
              onClick: () => navigate(`/whatsapp?conversation=${encodeURIComponent(conversation.id)}`),
            },
          });
        }

        const assignedLead = conversation.lead;
        const currentUserId = user?.id;
        if (
          event.reason === "LEAD_ASSIGNED"
          && currentUserId
          && assignedLead?.assignedSellerId === currentUserId
        ) {
          const assignedContact = assignedLead.contactName?.trim()
            || conversation.contactName?.trim()
            || assignedLead.companyName?.trim()
            || conversation.customerName?.trim()
            || conversation.participantPhone;
          notifier.info(`Se te asignó ${assignedContact} para seguimiento.`, {
            id: `whatsapp-assignment-${conversation.id}-${currentUserId}`,
            durationMs: 8_000,
            presentation: {
              variant: "whatsapp-message",
              title: "Nueva asignación",
              occurredAt: event.occurredAt,
            },
            action: {
              label: "Abrir chat",
              onClick: () => navigate(`/whatsapp?conversation=${encodeURIComponent(conversation.id)}`),
            },
          });
        }

        if (event.reason === "MESSAGE_RECEIVED" && event.message?.direction === "INBOUND") {
          const sender = conversation.contactName || conversation.customerName || conversation.participantPhone;
          const content = event.message.body?.trim()
            || (event.message.attachments.length > 0 ? "Archivo recibido" : "Nuevo mensaje recibido");
          notifier.info(content, {
            id: `whatsapp-message-${event.message.id}`,
            durationMs: 6_000,
            presentation: {
              variant: "whatsapp-message",
              title: sender,
              occurredAt: event.message.occurredAt,
            },
            action: {
              label: "Ver",
              onClick: () => navigate(`/whatsapp?conversation=${encodeURIComponent(conversation.id)}`),
            },
          });
        }
      } catch {
        // An event outside the current user's visibility scope is ignored.
      }
    };

    void refresh().catch(() => undefined);
    const realtime = new WhatsAppRealtimeClient({
      onEvent: (event) => { void syncConversation(event); },
      onReconnect: () => { void refresh().catch(() => undefined); },
      onStatusChange: setRealtimeStatus,
    });
    realtime.start();

    const handleRead = (rawEvent: Event): void => {
      const conversationId = (rawEvent as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!conversationId) return;
      setConversations((current) => current.map((conversation) => conversation.id === conversationId
        ? { ...conversation, unreadCount: 0 }
        : conversation));
    };
    const handleDeleted = (rawEvent: Event): void => {
      const conversationId = (rawEvent as CustomEvent<{ conversationId?: string }>).detail?.conversationId;
      if (!conversationId) return;
      setConversations((current) => current.filter((conversation) => conversation.id !== conversationId));
    };
    window.addEventListener("tuvansa:whatsapp-conversation-read", handleRead);
    window.addEventListener("tuvansa:whatsapp-conversation-deleted", handleDeleted);

    return () => {
      active = false;
      realtime.stop();
      window.removeEventListener("tuvansa:whatsapp-conversation-read", handleRead);
      window.removeEventListener("tuvansa:whatsapp-conversation-deleted", handleDeleted);
    };
  }, [enabled, navigate, refresh, user?.id]);

  const items = useMemo(() => [
    ...quoteNotifications,
    ...conversations.map(toNotification),
  ].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)), [conversations, quoteNotifications]);
  const unreadCount = useMemo(
    () => items.reduce((total, notification) => total + notification.unreadCount, 0),
    [items],
  );

  const markRead = useCallback(async (notification: AppNotification): Promise<void> => {
    if (notification.source === "QUOTE") {
      setQuoteNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, unreadCount: 0 }
        : item));
      return;
    }
    await WhatsAppInboxService.markRead(notification.sourceId);
  }, []);

  const value = useMemo(() => ({
    enabled,
    loading,
    items,
    unreadCount,
    realtimeStatus,
    refresh,
    markRead,
  }), [enabled, items, loading, markRead, realtimeStatus, refresh, unreadCount]);

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
    </AppNotificationsContext.Provider>
  );
};
