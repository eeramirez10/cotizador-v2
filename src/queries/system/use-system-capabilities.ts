import { useQuery } from "@tanstack/react-query";
import { SystemCapabilitiesService } from "../../modules/system/services/system-capabilities.service";

export const systemCapabilitiesKey = ["system", "capabilities"] as const;

export const useSystemCapabilities = () => useQuery({
  queryKey: systemCapabilitiesKey,
  queryFn: SystemCapabilitiesService.get,
  staleTime: 5 * 60 * 1000,
  retry: 1,
});
