import { useCallback, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";
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
import { SystemNotificationsService, type SystemNotificationRecord } from "../services/system-notifications.service";
import { SystemNotificationsRealtimeClient } from "../services/system-notifications-realtime.service";

const toSystemNotification = (row: SystemNotificationRecord): AppNotification => ({
  id: `system-${row.id}`,
  source: "SYSTEM",
  sourceId: row.id,
  kind: row.type,
  title: row.title,
  message: row.message,
  occurredAt: row.createdAt,
  unreadCount: row.readAt ? 0 : 1,
  href: row.targetPath,
});

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
  const [systemNotifications, setSystemNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [systemLoading, setSystemLoading] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<WhatsAppRealtimeStatus>("disconnected");
  const systemUserId = useRef(user?.id);
  systemUserId.current = user?.id;
  const role = (user?.role || "").trim().toLowerCase();
  const enabled = ["admin", "manager", "seller"].includes(role);
  const inboxEnabled = enabled && capabilities.data?.whatsAppInboxEnabled === true
    && user?.whatsappInboxEnabled !== false;

  const refresh = useCallback(async (): Promise<void> => {
    if (!inboxEnabled) return;
    setLoading(true);
    try {
      const result = await WhatsAppInboxService.list({ pageSize: 50 });
      setConversations(result.items);
    } finally {
      setLoading(false);
    }
  }, [inboxEnabled]);

  const refreshSystem = useCallback(async (): Promise<void> => {
    if (!enabled || !user?.id) return;
    const requestedUserId = user.id;
    setSystemLoading(true);
    try {
      const rows = await SystemNotificationsService.list();
      if (systemUserId.current === requestedUserId) setSystemNotifications(rows.map(toSystemNotification));
    } finally {
      if (systemUserId.current === requestedUserId) setSystemLoading(false);
    }
  }, [enabled, user?.id]);

  useEffect(() => {
    if (!enabled) {
      setSystemNotifications([]);
      return undefined;
    }
    setSystemNotifications([]);
    void refreshSystem().catch(() => undefined);
    const realtime = new SystemNotificationsRealtimeClient((event) => {
      if (systemUserId.current !== user?.id) return;
      const notification = toSystemNotification({
        ...event.notification,
        reference: "",
        createdAt: event.occurredAt,
        readAt: null,
      });
      setSystemNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id),
      ].slice(0, 50));
      notifier.success(notification.message, {
        id: notification.id,
        durationMs: 8_000,
        presentation: { variant: "quote-decision", title: notification.title, occurredAt: notification.occurredAt, tone: "success" },
        action: {
          label: "Ver expediente",
          onClick: () => {
            void SystemNotificationsService.markRead(notification.sourceId).then(() => {
              setSystemNotifications((current) => current.map((item) => item.id === notification.id
                ? { ...item, unreadCount: 0 }
                : item));
            }).catch(() => undefined);
            navigate(notification.href);
          },
        },
      });
    }, () => { void refreshSystem().catch(() => undefined); });
    realtime.start();
    return () => realtime.stop();
  }, [enabled, navigate, refreshSystem, user?.id]);

  useEffect(() => {
    if (!inboxEnabled) {
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
  }, [inboxEnabled, navigate, refresh, user?.id]);

  const items = useMemo(() => [
    ...systemNotifications,
    ...quoteNotifications,
    ...conversations.map(toNotification),
  ].sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt)), [conversations, quoteNotifications, systemNotifications]);
  const unreadCount = useMemo(
    () => items.reduce((total, notification) => total + notification.unreadCount, 0),
    [items],
  );

  const markRead = useCallback(async (notification: AppNotification): Promise<void> => {
    if (notification.source === "SYSTEM") {
      await SystemNotificationsService.markRead(notification.sourceId);
      setSystemNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, unreadCount: 0 }
        : item));
      return;
    }
    if (notification.source === "QUOTE") {
      setQuoteNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, unreadCount: 0 }
        : item));
      return;
    }
    await WhatsAppInboxService.markRead(notification.sourceId);
  }, []);

  const refreshAll = useCallback(async (): Promise<void> => {
    await Promise.allSettled([refreshSystem(), refresh()]);
  }, [refresh, refreshSystem]);

  const value = useMemo(() => ({
    enabled,
    inboxEnabled,
    loading: loading || systemLoading,
    items,
    unreadCount,
    realtimeStatus,
    refresh: refreshAll,
    markRead,
  }), [enabled, inboxEnabled, items, loading, markRead, realtimeStatus, refreshAll, systemLoading, unreadCount]);

  return (
    <AppNotificationsContext.Provider value={value}>
      {children}
    </AppNotificationsContext.Provider>
  );
};
