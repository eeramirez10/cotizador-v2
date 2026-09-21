import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SystemSettingsService, type SystemSettingKey } from "../../modules/system/services/system-settings.service";
import { systemCapabilitiesKey } from "./use-system-capabilities";

export const systemSettingsKey = ["system", "settings"] as const;

export const useSystemSettings = () => useQuery({
  queryKey: systemSettingsKey,
  queryFn: SystemSettingsService.list,
  staleTime: 30_000,
});

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: SystemSettingsService.update,
    onSuccess: async (settings) => {
      queryClient.setQueryData(systemSettingsKey, settings);
      await queryClient.invalidateQueries({ queryKey: systemCapabilitiesKey });
    },
  });
};

export const useResetSystemSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: SystemSettingKey[]) => SystemSettingsService.reset(keys),
    onSuccess: async (settings) => {
      queryClient.setQueryData(systemSettingsKey, settings);
      await queryClient.invalidateQueries({ queryKey: systemCapabilitiesKey });
    },
  });
};
