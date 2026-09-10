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
import {
  WhatsAppRealtimeClient,
  type WhatsAppRealtimeEvent,
  type WhatsAppRealtimeStatus,
} from "../services/whatsapp-realtime.service";

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
  private readonly messagesByConversation = new Map<string, ChatMessage[]>();
  private readonly conversations = new Map<string, WhatsAppInboxConversation>();
  private currentQuery = "";
  private realtimeClient: WhatsAppRealtimeClient | null = null;
  private syncQueue: Promise<void> = Promise.resolve();
  private readonly currentUser: { id: string; displayName: string };
  private readonly onConversationData: (items: WhatsAppInboxConversation[]) => void;
  private readonly onRealtimeStatusChange: (status: WhatsAppRealtimeStatus) => void;
  private readonly onMessageData: (conversationId: string, messages: ChatMessage[]) => void;

  constructor(
    currentUser: { id: string; displayName: string },
    onConversationData: (items: WhatsAppInboxConversation[]) => void,
    onRealtimeStatusChange: (status: WhatsAppRealtimeStatus) => void,
    onMessageData: (conversationId: string, messages: ChatMessage[]) => void,
  ) {
    this.currentUser = currentUser;
    this.onConversationData = onConversationData;
    this.onRealtimeStatusChange = onRealtimeStatusChange;
    this.onMessageData = onMessageData;
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
    const result = await WhatsAppInboxService.messages(input.conversationId, { cursor: input.cursor });
    const messages = result.items.map((item) => this.mapMessage(item));
    messages.forEach((message) => {
      this.knownMessageIds.add(message.id);
      this.messageFingerprints.set(message.id, this.fingerprint(message));
    });
    const current = input.cursor ? this.messagesByConversation.get(input.conversationId) || [] : [];
    const snapshot = this.mergeMessages(current, messages);
    this.messagesByConversation.set(input.conversationId, snapshot);
    this.onMessageData(input.conversationId, snapshot);
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
    this.realtimeClient?.stop();
    const client = new WhatsAppRealtimeClient({
      onEvent: (event) => this.enqueueSync(() => this.syncRealtimeEvent(event, input.onEvent)),
      onReconnect: () => this.enqueueSync(() => this.recoverRealtimeState(input.onEvent)),
      onStatusChange: this.onRealtimeStatusChange,
    });
    this.realtimeClient = client;
    client.start();
    return () => {
      client.stop();
      if (this.realtimeClient === client) this.realtimeClient = null;
    };
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

  private enqueueSync(operation: () => Promise<void>): void {
    this.syncQueue = this.syncQueue.then(operation).catch(() => undefined);
  }

  private async syncRealtimeEvent(
    event: WhatsAppRealtimeEvent,
    emit: (event: ChatRealtimeEvent) => void,
  ): Promise<void> {
    if (!this.conversations.has(event.conversationId)) {
      await this.syncConversation(event.conversationId, emit);
    } else if (event.conversation || event.message) {
      this.applyConversationEvent(event, emit);
    }

    if (event.message) {
      this.applyMessage(event.message, emit);
      return;
    }
    if (event.messagePatch) this.applyMessagePatch(event.conversationId, event.messagePatch, emit);

    // Compatibility during a rolling deployment with backend instances using the old event contract.
    if (!event.message && !event.messagePatch && !event.conversation) {
      await this.syncMessagesSnapshot(event.conversationId, emit);
    }
  }

  private async recoverRealtimeState(emit: (event: ChatRealtimeEvent) => void): Promise<void> {
    if (!this.activeConversationId) return;
    await this.syncConversation(this.activeConversationId, emit);
    await this.syncMessagesSince(this.activeConversationId, emit);
  }

  private async syncConversation(
    conversationId: string,
    emit: (event: ChatRealtimeEvent) => void,
  ): Promise<void> {
    const existed = this.conversations.has(conversationId);
    const conversation = await WhatsAppInboxService.get(conversationId);
    this.storeConversations([conversation]);
    emit({
      type: existed ? "conversation-updated" : "conversation-added",
      conversation: this.mapConversation(conversation),
    });
  }

  private async syncMessagesSnapshot(
    conversationId: string,
    emit: (event: ChatRealtimeEvent) => void,
  ): Promise<void> {
    const result = await WhatsAppInboxService.messages(conversationId);
    const messages = result.items.map((item) => this.mapMessage(item));
    this.messagesByConversation.set(conversationId, messages);
    this.onMessageData(conversationId, messages);
    messages.forEach((message) => {
      const fingerprint = this.fingerprint(message);
      if (this.knownMessageIds.has(message.id)) {
        if (this.messageFingerprints.get(message.id) !== fingerprint) {
          this.messageFingerprints.set(message.id, fingerprint);
          emit({ type: "message-updated", message });
        }
        return;
      }
      this.knownMessageIds.add(message.id);
      this.messageFingerprints.set(message.id, fingerprint);
      emit({ type: "message-added", message });
    });
  }

  private async syncMessagesSince(
    conversationId: string,
    emit: (event: ChatRealtimeEvent) => void,
  ): Promise<void> {
    const current = this.messagesByConversation.get(conversationId) || [];
    const latest = current[current.length - 1]?.createdAt;
    if (!latest) return;

    let after = latest;
    for (let page = 0; page < 5; page += 1) {
      const result = await WhatsAppInboxService.messages(conversationId, { after, pageSize: 100 });
      result.items.forEach((message) => this.applyMessage(message, emit));
      if (!result.hasMore || !result.nextCursor) break;
      after = result.nextCursor;
    }
  }

  private applyConversationEvent(
    event: WhatsAppRealtimeEvent,
    emit: (event: ChatRealtimeEvent) => void,
  ): void {
    const current = this.conversations.get(event.conversationId);
    if (!current) return;
    const message = event.message;
    const incoming = message?.direction === "INBOUND";
    const next: WhatsAppInboxConversation = {
      ...current,
      ...event.conversation,
      lastMessage: event.conversation?.lastMessage || message?.body || current.lastMessage,
      lastMessageAt: event.conversation?.lastMessageAt || message?.occurredAt || current.lastMessageAt,
      lastInboundAt: event.conversation?.lastInboundAt ?? (incoming ? message.occurredAt : current.lastInboundAt),
      unreadCount: incoming && this.activeConversationId !== event.conversationId
        ? current.unreadCount + 1
        : current.unreadCount,
    };
    this.conversations.set(next.id, next);
    this.notifyConversationData();
    emit({ type: "conversation-updated", conversation: this.mapConversation(next) });
  }

  private applyMessage(
    item: WhatsAppInboxMessage,
    emit: (event: ChatRealtimeEvent) => void,
  ): void {
    const message = this.mapMessage(item);
    const current = this.messagesByConversation.get(item.conversationId) || [];
    const existed = current.some((candidate) => candidate.id === message.id);
    const next = this.mergeMessages(current, [message]);
    this.messagesByConversation.set(item.conversationId, next);
    this.knownMessageIds.add(message.id);
    this.messageFingerprints.set(message.id, this.fingerprint(message));
    if (this.activeConversationId === item.conversationId) this.onMessageData(item.conversationId, next);
    emit({ type: existed ? "message-updated" : "message-added", message });
  }

  private applyMessagePatch(
    conversationId: string,
    patch: NonNullable<WhatsAppRealtimeEvent["messagePatch"]>,
    emit: (event: ChatRealtimeEvent) => void,
  ): void {
    const current = this.messagesByConversation.get(conversationId) || [];
    const index = current.findIndex((message) => message.id === patch.id);
    if (index < 0) return;
    const status: ChatMessage["status"] = patch.status === "FAILED"
      ? "error"
      : patch.status === "READ"
        ? "read"
        : "sent";
    const message = { ...current[index], status };
    const next = current.map((candidate, candidateIndex) => candidateIndex === index ? message : candidate);
    this.messagesByConversation.set(conversationId, next);
    if (this.activeConversationId === conversationId) this.onMessageData(conversationId, next);
    emit({ type: "message-updated", message });
  }

  private mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
    const byId = new Map(current.map((message) => [message.id, message]));
    incoming.forEach((message) => byId.set(message.id, message));
    return [...byId.values()].sort(
      (left, right) => Date.parse(left.createdAt || "") - Date.parse(right.createdAt || ""),
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
    const conversation = this.conversations.get(item.conversationId);
    const authorName = outbound
      ? item.authorType === "AI"
        ? "Asistente Tuvansa"
        : item.authorType === "USER"
          ? item.authorName || this.currentUser.displayName
          : item.authorName || "Tuvansa"
      : conversation?.contactName || conversation?.customerName || item.authorName || "Cliente";

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
        // MUI uses the author id, not only the role, to decide the message side.
        // AI and human replies both belong to the outbound Tuvansa side.
        id: outbound ? this.currentUser.id : `customer-${item.conversationId}`,
        displayName: authorName,
        role: outbound ? "user" : "assistant",
      },
    };
  }

  private fingerprint(message: ChatMessage): string {
    return JSON.stringify([message.status, message.updatedAt, message.parts]);
  }
}
