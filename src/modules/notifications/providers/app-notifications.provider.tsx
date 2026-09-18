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
  title: conversation.contactName || conversation.customerName || conversation.participantPhone,
  message: conversation.lastMessage || "Mensaje recibido",
  occurredAt: conversation.lastMessageAt,
  unreadCount: conversation.unreadCount,
  href: `/whatsapp?conversation=${encodeURIComponent(conversation.id)}`,
});

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
      setRealtimeStatus("disconnected");
      return undefined;
    }

    let active = true;
    const syncConversation = async (event: WhatsAppRealtimeEvent): Promise<void> => {
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

  const items = useMemo(() => conversations.map(toNotification), [conversations]);
  const unreadCount = useMemo(
    () => conversations.reduce((total, conversation) => total + conversation.unreadCount, 0),
    [conversations],
  );

  const markRead = useCallback(async (notification: AppNotification): Promise<void> => {
    if (notification.source !== "WHATSAPP") return;
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
