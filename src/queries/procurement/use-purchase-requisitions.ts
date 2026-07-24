import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PurchaseRequisitionsService,
  type RequisitionStatus,
  type SaveOfferInput,
  type SaveSupplierInput,
  type UpdateRequisitionItemInput,
} from "../../modules/procurement/services/purchase-requisitions.service";

export const purchaseRequisitionKeys = {
  all: ["purchase-requisitions"] as const,
  list: (params: object) => [...purchaseRequisitionKeys.all, "list", params] as const,
  detail: (id: string) => [...purchaseRequisitionKeys.all, "detail", id] as const,
  byQuote: (quoteId: string) => [...purchaseRequisitionKeys.all, "quote", quoteId] as const,
  suppliers: ["purchase-requisitions", "suppliers"] as const,
};

export const usePurchaseRequisitions = (params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: RequisitionStatus | "ALL";
}) => useQuery({
  queryKey: purchaseRequisitionKeys.list(params),
  queryFn: () => PurchaseRequisitionsService.list(params),
  placeholderData: keepPreviousData,
  staleTime: 10_000,
});

export const usePurchaseRequisition = (id: string | null) => useQuery({
  queryKey: purchaseRequisitionKeys.detail(id || ""),
  queryFn: () => PurchaseRequisitionsService.get(id!),
  enabled: Boolean(id),
});

export const useQuotePurchaseRequisition = (quoteId?: string, enabled = true) => useQuery({
  queryKey: purchaseRequisitionKeys.byQuote(quoteId || ""),
  queryFn: () => PurchaseRequisitionsService.getByQuote(quoteId!),
  enabled: Boolean(quoteId) && enabled,
  retry: false,
});

export const useSuppliers = (enabled = true) => useQuery({
  queryKey: purchaseRequisitionKeys.suppliers,
  queryFn: () => PurchaseRequisitionsService.listSuppliers(),
  enabled,
  staleTime: 30_000,
});

export const usePurchaseRequisitionMutations = () => {
  const client = useQueryClient();
  const refresh = async () => client.invalidateQueries({ queryKey: purchaseRequisitionKeys.all });
  const updateItem = useMutation({
    mutationFn: ({ id, itemId, input }: { id: string; itemId: string; input: UpdateRequisitionItemInput }) =>
      PurchaseRequisitionsService.updateItem(id, itemId, input),
    onSuccess: refresh,
  });
  const submit = useMutation({ mutationFn: PurchaseRequisitionsService.submit, onSuccess: refresh });
  const linkItemToErp = useMutation({
    mutationFn: ({ id, itemId, erpCode, erpEan }: { id: string; itemId: string; erpCode: string; erpEan: string }) =>
      PurchaseRequisitionsService.linkItemToErp(id, itemId, { erpCode, erpEan }),
    onSuccess: refresh,
  });
  const assign = useMutation({
    mutationFn: ({ id, buyerUserId }: { id: string; buyerUserId: string }) =>
      PurchaseRequisitionsService.assign(id, buyerUserId),
    onSuccess: refresh,
  });
  const createOffer = useMutation({
    mutationFn: ({ id, itemId, input }: { id: string; itemId: string; input: SaveOfferInput }) =>
      PurchaseRequisitionsService.createOffer(id, itemId, input),
    onSuccess: refresh,
  });
  const selectOffer = useMutation({
    mutationFn: ({ id, itemId, offerId }: { id: string; itemId: string; offerId: string }) =>
      PurchaseRequisitionsService.selectOffer(id, itemId, offerId),
    onSuccess: refresh,
  });
  const approveCostVariance = useMutation({
    mutationFn: PurchaseRequisitionsService.approveCostVariance,
    onSuccess: refresh,
  });
  const createSupplier = useMutation({
    mutationFn: (input: SaveSupplierInput) => PurchaseRequisitionsService.createSupplier(input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: purchaseRequisitionKeys.suppliers });
    },
  });

  return {
    updateItem,
    linkItemToErp,
    submit,
    assign,
    createOffer,
    selectOffer,
    approveCostVariance,
    createSupplier,
    isPending: updateItem.isPending || linkItemToErp.isPending || submit.isPending || assign.isPending || createOffer.isPending
      || selectOffer.isPending || approveCostVariance.isPending || createSupplier.isPending,
  };
};
