import { useQuery } from "@tanstack/react-query";
import { AnalyticsService, type AnalyticsParams } from "../../modules/analytics/services/analytics.service";

export const useBranchAnalytics = (params: AnalyticsParams, enabled: boolean) =>
  useQuery({ queryKey: ["analytics", "branch", params], queryFn: () => AnalyticsService.branch(params), enabled, staleTime: 30_000, refetchOnWindowFocus: false });

export const useUserAnalytics = (params: AnalyticsParams, enabled: boolean) =>
  useQuery({ queryKey: ["analytics", "user", params], queryFn: () => AnalyticsService.user(params), enabled, staleTime: 30_000, refetchOnWindowFocus: false });
