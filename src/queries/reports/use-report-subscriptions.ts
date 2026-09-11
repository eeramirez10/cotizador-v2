import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ReportSubscriptionsService,
  type UpsertManagerReportSubscriptionInput,
} from "../../modules/reports/services/report-subscriptions.service";

const reportSubscriptionsKeys = {
  all: ["report-subscriptions"] as const,
  list: () => [...reportSubscriptionsKeys.all, "list"] as const,
};

export const useReportSubscriptions = () => useQuery({
  queryKey: reportSubscriptionsKeys.list(),
  queryFn: () => ReportSubscriptionsService.list(),
  staleTime: 30_000,
  refetchOnWindowFocus: false,
});

export const useCreateReportSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertManagerReportSubscriptionInput) => ReportSubscriptionsService.create(input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: reportSubscriptionsKeys.all }),
  });
};

export const useUpdateReportSubscription = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      subscriptionId,
      input,
    }: {
      subscriptionId: string;
      input: UpsertManagerReportSubscriptionInput;
    }) => ReportSubscriptionsService.update(subscriptionId, input),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: reportSubscriptionsKeys.all }),
  });
};

export const useSetReportSubscriptionActive = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ subscriptionId, isActive }: { subscriptionId: string; isActive: boolean }) =>
      ReportSubscriptionsService.setActive(subscriptionId, isActive),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: reportSubscriptionsKeys.all }),
  });
};

export const useSendManagerReportNow = () => useMutation({
  mutationFn: (subscriptionId: string) => ReportSubscriptionsService.sendNow(subscriptionId),
});
