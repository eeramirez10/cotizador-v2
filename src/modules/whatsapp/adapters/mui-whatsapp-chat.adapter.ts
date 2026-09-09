import type {
  ChatAdapter,
  ChatConversation,
  ChatMessage,
  ChatMessageChunk,
  ChatRealtimeEvent,
  ChatStreamEnvelope,
} from "@mui/x-chat-headless";
import {
  WhatsAppInboxService,
  type WhatsAppInboxConversation,
  type WhatsAppInboxMessage,
} from "../services/whatsapp-inbox.service";

const EMPTY_STREAM = (): ReadableStream<ChatMessageChunk | ChatStreamEnvelope> =>
  new ReadableStream({ start: (controller) => controller.close() });

const textFromMessage = (message: ChatMessage): string =>
  message.parts
    .map((part) => part.type === "text" ? part.text : "")
    .filter(Boolean)
    .join("\n")
    .trim();

export class MuiWhatsAppChatAdapter implements ChatAdapter<string> {
  private activeConversationId: string | undefined;
  private readonly knownMessageIds = new Set<string>();
  private readonly messageFingerprints = new Map<string, string>();
  private readonly conversations = new Map<string, WhatsAppInboxConversation>();
  private stopped = false;
  private currentQuery = "";
  private readonly currentUser: { id: string; displayName: string };
  private readonly onConversationData: (items: WhatsAppInboxConversation[]) => void;

  constructor(
    currentUser: { id: string; displayName: string },
    onConversationData: (items: WhatsAppInboxConversation[]) => void,
  ) {
    this.currentUser = currentUser;
    this.onConversationData = onConversationData;
  }

  async listConversations(input?: { cursor?: string; query?: string }) {
    const nextQuery = input?.query?.trim() || "";
    if (!input?.cursor && nextQuery !== this.currentQuery) {
      this.conversations.clear();
    }
    this.currentQuery = nextQuery;
    const result = await WhatsAppInboxService.list({
      cursor: input?.cursor,
      query: this.currentQuery,
      pageSize: 30,
    });
    this.storeConversations(result.items);
    return {
      conversations: result.items.map((item) => this.mapConversation(item)),
      cursor: result.nextCursor || undefined,
      hasMore: result.hasMore,
    };
  }

  async listMessages(input: { conversationId: string; cursor?: string }) {
    this.activeConversationId = input.conversationId;
    const result = await WhatsAppInboxService.messages(input.conversationId, input.cursor);
    const messages = result.items.map((item) => this.mapMessage(item));
    messages.forEach((message) => {
      this.knownMessageIds.add(message.id);
      this.messageFingerprints.set(message.id, this.fingerprint(message));
    });
    return {
      messages,
      cursor: result.nextCursor || undefined,
      hasMore: result.hasMore,
    };
  }

  async sendMessage(input: {
    conversationId?: string;
    message: ChatMessage;
    messages: ChatMessage[];
    signal: AbortSignal;
  }): Promise<ReadableStream<ChatMessageChunk | ChatStreamEnvelope>> {
    if (!input.conversationId) throw new Error("Selecciona una conversación.");
    const body = textFromMessage(input.message);
    await WhatsAppInboxService.send(input.conversationId, body, input.message.id);
    this.knownMessageIds.add(input.message.id);
    return EMPTY_STREAM();
  }

  async markRead(input: { conversationId: string }): Promise<void> {
    await WhatsAppInboxService.markRead(input.conversationId);
    const current = this.conversations.get(input.conversationId);
    if (current) {
      this.conversations.set(input.conversationId, { ...current, unreadCount: 0 });
      this.notifyConversationData();
    }
  }

  subscribe(input: { onEvent: (event: ChatRealtimeEvent) => void }): () => void {
    this.stopped = false;
    const refresh = async () => {
      if (this.stopped) return;
      try {
        const previousConversationIds = new Set(this.conversations.keys());
        const result = await WhatsAppInboxService.list({ pageSize: 50, query: this.currentQuery });
        this.storeConversations(result.items);
        result.items.forEach((item) => {
          input.onEvent({
            type: previousConversationIds.has(item.id) ? "conversation-updated" : "conversation-added",
            conversation: this.mapConversation(item),
          });
        });
        if (!this.activeConversationId) return;
        const messages = await WhatsAppInboxService.messages(this.activeConversationId);
        messages.items.forEach((item) => {
          const message = this.mapMessage(item);
          const fingerprint = this.fingerprint(message);
          if (this.knownMessageIds.has(item.id)) {
            if (this.messageFingerprints.get(item.id) !== fingerprint) {
              this.messageFingerprints.set(item.id, fingerprint);
              input.onEvent({ type: "message-updated", message });
            }
            return;
          }
          this.knownMessageIds.add(item.id);
          this.messageFingerprints.set(item.id, fingerprint);
          input.onEvent({ type: "message-added", message });
        });
      } catch {
        // Polling failures are transient; direct actions still surface their errors.
      }
    };
    const interval = window.setInterval(() => void refresh(), 5_000);
    return () => {
      this.stopped = true;
      window.clearInterval(interval);
    };
  }

  stop(): void {
    this.stopped = true;
  }

  setActiveConversation(conversationId: string | undefined): void {
    this.activeConversationId = conversationId;
  }

  updateConversation(conversation: WhatsAppInboxConversation): void {
    this.conversations.set(conversation.id, conversation);
    this.notifyConversationData();
  }

  getConversation(conversationId?: string): WhatsAppInboxConversation | undefined {
    return conversationId ? this.conversations.get(conversationId) : undefined;
  }

  private storeConversations(items: WhatsAppInboxConversation[]): void {
    items.forEach((item) => this.conversations.set(item.id, item));
    this.notifyConversationData();
  }

  private notifyConversationData(): void {
    this.onConversationData(
      [...this.conversations.values()].sort(
        (left, right) => Date.parse(right.lastMessageAt) - Date.parse(left.lastMessageAt),
      ),
    );
  }

  private mapConversation(item: WhatsAppInboxConversation): ChatConversation {
    return {
      id: item.id,
      title: item.customerName,
      subtitle: item.lastMessage,
      unreadCount: item.unreadCount,
      readState: item.unreadCount > 0 ? "unread" : "read",
      lastMessageAt: item.lastMessageAt,
      participants: [
        {
          id: `customer-${item.id}`,
          displayName: item.contactName || item.customerName,
          role: "assistant",
        },
        {
          id: this.currentUser.id,
          displayName: this.currentUser.displayName,
          role: "user",
        },
      ],
    };
  }

  private mapMessage(item: WhatsAppInboxMessage): ChatMessage {
    const outbound = item.direction === "OUTBOUND";
    return {
      id: item.id,
      conversationId: item.conversationId,
      role: outbound ? "user" : "assistant",
      parts: [{ type: "text", text: item.body }],
      createdAt: item.occurredAt,
      status: item.status === "FAILED"
        ? "error"
        : item.status === "READ"
          ? "read"
          : "sent",
      author: {
        id: outbound
          ? item.authorType === "AI" ? "tuvansa-ai" : item.authorType === "USER" ? this.currentUser.id : "tuvansa"
          : `customer-${item.conversationId}`,
        displayName: item.authorName,
        role: outbound ? "user" : "assistant",
      },
    };
  }

  private fingerprint(message: ChatMessage): string {
    return JSON.stringify([message.status, message.updatedAt, message.parts]);
  }
}
