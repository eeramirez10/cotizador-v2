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
  supplierList: (params: object) => [...purchaseRequisitionKeys.suppliers, params] as const,
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

export const useSuppliers = (enabled = true, params?: { search?: string; includeInactive?: boolean }) => useQuery({
  queryKey: purchaseRequisitionKeys.supplierList(params || {}),
  queryFn: () => PurchaseRequisitionsService.listSuppliers(params?.search, params?.includeInactive),
  enabled,
  staleTime: 30_000,
});

export const useErpSupplierSearch = (term: string, enabled = true) => useQuery({
  queryKey: ["purchase-requisitions", "erp-suppliers", term],
  queryFn: ({ signal }) => PurchaseRequisitionsService.searchErpSuppliers(term, signal),
  enabled: enabled && term.trim().length > 0,
  staleTime: 30_000,
  refetchOnWindowFocus: false,
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
  const updateSupplier = useMutation({
    mutationFn: ({ supplierId, input }: { supplierId: string; input: SaveSupplierInput }) =>
      PurchaseRequisitionsService.updateSupplier(supplierId, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: purchaseRequisitionKeys.suppliers });
    },
  });
  const setSupplierActive = useMutation({
    mutationFn: ({ supplierId, isActive }: { supplierId: string; isActive: boolean }) =>
      PurchaseRequisitionsService.setSupplierActive(supplierId, isActive),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: purchaseRequisitionKeys.suppliers });
    },
  });
  const syncErpSupplier = useMutation({
    mutationFn: PurchaseRequisitionsService.syncErpSupplier,
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
    updateSupplier,
    setSupplierActive,
    syncErpSupplier,
    isPending: updateItem.isPending || linkItemToErp.isPending || submit.isPending || assign.isPending || createOffer.isPending
      || selectOffer.isPending || approveCostVariance.isPending || createSupplier.isPending || updateSupplier.isPending
      || setSupplierActive.isPending || syncErpSupplier.isPending,
  };
};
