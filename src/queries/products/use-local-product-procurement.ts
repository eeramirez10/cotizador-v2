import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LocalProductProcurementService,
  type ProcurementOfferInput,
  type ProductProcurementStatus,
} from "../../modules/products/services/local-product-procurement.service";

const keys = {
  all: ["local-product-procurement"] as const,
  list: (params: object) => [...keys.all, "list", params] as const,
  detail: (productId: string) => [...keys.all, "detail", productId] as const,
};

export const useProcurementProducts = (params: {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductProcurementStatus | "ALL";
}) => useQuery({
  queryKey: keys.list(params),
  queryFn: () => LocalProductProcurementService.list(params),
  placeholderData: keepPreviousData,
  staleTime: 10_000,
});

export const useProcurementProduct = (productId: string | null) => useQuery({
  queryKey: keys.detail(productId || ""),
  queryFn: () => LocalProductProcurementService.get(productId!),
  enabled: Boolean(productId),
});

export const useProcurementMutations = () => {
  const queryClient = useQueryClient();
  const refresh = async (productId?: string) => {
    await queryClient.invalidateQueries({ queryKey: keys.all });
    if (productId) await queryClient.invalidateQueries({ queryKey: keys.detail(productId) });
  };

  const createOffer = useMutation({
    mutationFn: ({ productId, input }: { productId: string; input: ProcurementOfferInput }) =>
      LocalProductProcurementService.createOffer(productId, input),
    onSuccess: (product) => refresh(product.id),
  });
  const updateOffer = useMutation({
    mutationFn: ({ productId, offerId, input }: { productId: string; offerId: string; input: ProcurementOfferInput }) =>
      LocalProductProcurementService.updateOffer(productId, offerId, input),
    onSuccess: (product) => refresh(product.id),
  });
  const deactivateOffer = useMutation({
    mutationFn: ({ offerId }: { offerId: string; productId: string }) =>
      LocalProductProcurementService.deactivateOffer(offerId),
    onSuccess: (_, variables) => refresh(variables.productId),
  });
  const selectOffer = useMutation({
    mutationFn: ({ productId, offerId }: { productId: string; offerId: string }) =>
      LocalProductProcurementService.selectOffer(productId, offerId),
    onSuccess: (product) => refresh(product.id),
  });
  const changeStatus = useMutation({
    mutationFn: ({ productId, status, comment }: { productId: string; status: ProductProcurementStatus; comment?: string | null }) =>
      LocalProductProcurementService.changeStatus(productId, status, comment),
    onSuccess: (product) => refresh(product.id),
  });

  return {
    createOffer,
    updateOffer,
    deactivateOffer,
    selectOffer,
    changeStatus,
    isPending: createOffer.isPending
      || updateOffer.isPending
      || deactivateOffer.isPending
      || selectOffer.isPending
      || changeStatus.isPending,
  };
};
