import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { WhatsAppInboxService } from "../../modules/whatsapp/services/whatsapp-inbox.service";
import type { WhatsAppRealtimeEvent } from "../../modules/whatsapp/services/whatsapp-realtime.service";

export const useWhatsAppUnreadCount = (enabled: boolean) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    const refresh = (event: Event) => {
      const realtimeEvent = (event as CustomEvent<WhatsAppRealtimeEvent>).detail;
      if (realtimeEvent?.reason !== "MESSAGE_RECEIVED") return;
      void queryClient.invalidateQueries({ queryKey: ["whatsapp", "unread"] });
    };
    window.addEventListener("tuvansa:whatsapp-realtime", refresh);
    return () => window.removeEventListener("tuvansa:whatsapp-realtime", refresh);
  }, [enabled, queryClient]);

  return useQuery({
    queryKey: ["whatsapp", "unread"],
    queryFn: async () => {
      const result = await WhatsAppInboxService.list({ pageSize: 50 });
      return result.items.reduce((total, item) => total + item.unreadCount, 0);
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
};
