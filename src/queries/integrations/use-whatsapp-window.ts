import { useQuery } from "@tanstack/react-query";
import { WhatsAppService } from "../../modules/integrations/services/whatsapp.service";

export const useWhatsAppConversationWindow = (phone: string, enabled: boolean) => useQuery({
  queryKey: ["integrations", "whatsapp", "window", phone],
  queryFn: () => WhatsAppService.getConversationWindow(phone),
  enabled: enabled && Boolean(phone.trim()),
  staleTime: 0,
  refetchOnMount: "always",
  retry: 1,
});
