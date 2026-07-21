import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QuoteCatalogsService, type QuoteCatalogType, type SuggestQuoteCatalogCodeInput, type UpsertQuoteCatalogOptionInput } from "../../modules/quote-catalogs/services/quote-catalogs.service";

const key = ["quote-catalogs"] as const;
export const useQuoteCatalogs = (type?: QuoteCatalogType) => useQuery({ queryKey: [...key, type || "all"], queryFn: () => QuoteCatalogsService.list(type), staleTime: 30_000 });
export const useManagedQuoteCatalogs = () => useQuery({ queryKey: [...key, "manage"], queryFn: QuoteCatalogsService.listManaged, staleTime: 30_000, refetchOnMount: "always" });
export const useCreateQuoteCatalogOption = () => { const client = useQueryClient(); return useMutation({ mutationFn: (input: UpsertQuoteCatalogOptionInput) => QuoteCatalogsService.create(input), onSuccess: () => client.invalidateQueries({ queryKey: key }) }); };
export const useUpdateQuoteCatalogOption = () => { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id: string; input: UpsertQuoteCatalogOptionInput }) => QuoteCatalogsService.update(id, input), onSuccess: () => client.invalidateQueries({ queryKey: key }) }); };
export const useDeactivateQuoteCatalogOption = () => { const client = useQueryClient(); return useMutation({ mutationFn: QuoteCatalogsService.deactivate, onSuccess: () => client.invalidateQueries({ queryKey: key }) }); };
export const useSuggestQuoteCatalogCode = () => useMutation({ mutationFn: (input: SuggestQuoteCatalogCodeInput) => QuoteCatalogsService.suggestCode(input) });
