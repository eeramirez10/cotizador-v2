import { useQuery } from "@tanstack/react-query";
import { WhatsAppInboxService } from "../../modules/whatsapp/services/whatsapp-inbox.service";

export const useWhatsAppUnreadCount = (enabled: boolean) => useQuery({
  queryKey: ["whatsapp", "unread"],
  queryFn: async () => {
    const result = await WhatsAppInboxService.list({ pageSize: 50 });
    return result.items.reduce((total, item) => total + item.unreadCount, 0);
  },
  enabled,
  staleTime: 10_000,
  refetchInterval: 15_000,
  refetchOnWindowFocus: true,
});
