import { lazy, Suspense, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle } from "@mui/material";
import type { RequisitionItem, UpdateRequisitionDocumentInput } from "../../modules/procurement/services/purchase-requisitions.service";
import { usePurchaseRequisition, usePurchaseRequisitionMutations } from "../../queries/procurement/use-purchase-requisitions";
import { notifier } from "../../shared/notifications/notifier";
import { useAuthStore } from "../../store/auth/auth.store";
import { RequisitionPaperCard } from "../procurement/requisition-paper-card";

const PurchaseOffersBatchModal = lazy(() => import("../procurement/purchase-offers-batch.modal")
  .then((module) => ({ default: module.PurchaseOffersBatchModal })));

export const QuoteRequisitionModal = ({ requisitionId, onClose }: { requisitionId: string; onClose: () => void }) => {
  const detail = usePurchaseRequisition(requisitionId);
  const mutations = usePurchaseRequisitionMutations();
  const user = useAuthStore((state) => state.user);
  const role = (user?.role || "").toUpperCase();
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [editingSupplierQuoteId, setEditingSupplierQuoteId] = useState<string | null>(null);
  const requisition = detail.data;
  const canBuy = role === "ADMIN" || role === "PURCHASING";
  const canEditOffers = canBuy && Boolean(requisition)
    && !["DRAFT", "COMPLETED", "CANCELLED"].includes(requisition!.status)
    && !requisition!.supplierRequisitions.length;
  const activeItem = requisition?.items.find((item) => item.id === activeItemId);
  const buyerQuotes = requisition?.items.flatMap((item) => item.offers
    .filter((offer) => offer.source === "PURCHASING" && offer.supplierQuoteId)
    .map((offer) => ({ id: offer.supplierQuoteId!, supplier: offer.supplier.name, reference: offer.supplierQuote?.reference }))) || [];
  const uniqueBuyerQuotes = [...new Map(buyerQuotes.map((quote) => [quote.id, quote])).values()];

  const saveDocument = async (input: UpdateRequisitionDocumentInput): Promise<boolean> => {
    try {
      await mutations.updateDocument.mutateAsync({ id: requisitionId, input });
      notifier.success("Datos de la requisición actualizados.");
      return true;
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo actualizar la requisición.");
      return false;
    }
  };

  const saveSupplierCode = async (itemId: string, offerId: string, supplierProductCode: string | null): Promise<boolean> => {
    try {
      await mutations.updateSupplierCode.mutateAsync({ id: requisitionId, itemId, offerId, supplierProductCode });
      notifier.success("Código del proveedor actualizado.");
      return true;
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo actualizar el código del proveedor.");
      return false;
    }
  };

  return (
    <>
      <Dialog open={!editingSupplierQuoteId} onClose={onClose} maxWidth={false} fullWidth PaperProps={{ sx: { width: "min(1600px, 96vw)", maxHeight: "94vh" } }}>
        <DialogTitle sx={{ fontSize: 18, fontWeight: 600 }}>
          {requisition ? `Requisición ${requisition.requisitionNumber}` : "Requisición de compra"}
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2 }}>
          {detail.isLoading && <p className="text-sm text-slate-600">Cargando requisición...</p>}
          {detail.isError && <p className="text-sm text-rose-700">No se pudo cargar la requisición. Intenta nuevamente.</p>}
          {requisition && (
            <>
              <p className="mb-3 text-xs text-slate-600">
                {canEditOffers ? "Puedes revisar y editar las cotizaciones capturadas por Compras." : "Las cotizaciones de Compras se muestran para consulta; solo Compras o administración pueden modificarlas."}
              </p>
              {uniqueBuyerQuotes.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {uniqueBuyerQuotes.map((quote) => (
                    <Button key={quote.id} size="small" variant="outlined" disabled={!canEditOffers} onClick={() => setEditingSupplierQuoteId(quote.id)}>
                      {canEditOffers ? "Editar" : "Cotización"} {quote.supplier}{quote.reference ? ` · ${quote.reference}` : ""}
                    </Button>
                  ))}
                </div>
              )}
              <RequisitionPaperCard
                requisition={requisition}
                canEditDocument={(canBuy && !["COMPLETED", "CANCELLED"].includes(requisition.status))
                  || (role === "SELLER" && requisition.status === "DRAFT" && requisition.requestedByUserId === user?.id)}
                canEditOfferCode={(canBuy || (role === "SELLER" && requisition.status === "DRAFT")) && !requisition.supplierRequisitions.length}
                role={role}
                busy={mutations.isPending}
                onSaveDocument={saveDocument}
                onSaveSupplierCode={saveSupplierCode}
                onOpenItem={(item: RequisitionItem) => setActiveItemId(item.id)}
              />
            </>
          )}
        </DialogContent>
        <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(activeItemId) && !editingSupplierQuoteId} onClose={() => setActiveItemId(null)} fullWidth maxWidth="sm">
        <DialogTitle>Partida {activeItem?.position}</DialogTitle>
        <DialogContent dividers>
          <p className="text-sm text-slate-700">{activeItem?.customerDescription || activeItem?.description}</p>
          <div className="mt-3 space-y-2">
            {activeItem?.offers.map((offer) => (
              <div key={offer.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3 text-sm">
                <span>{offer.supplier.name} · {offer.currency} {offer.unitCost.toLocaleString("es-MX")} · {offer.source === "PURCHASING" ? "Compras" : "Ventas"}</span>
                {canEditOffers && offer.source === "PURCHASING" && offer.supplierQuoteId && (
                  <Button size="small" onClick={() => { setActiveItemId(null); setEditingSupplierQuoteId(offer.supplierQuoteId); }}>Editar cotización</Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions><Button onClick={() => setActiveItemId(null)}>Cerrar</Button></DialogActions>
      </Dialog>

      {requisition && editingSupplierQuoteId && (
        <Suspense fallback={<p className="text-sm text-slate-600">Cargando editor de Compras...</p>}>
          <PurchaseOffersBatchModal
            key={editingSupplierQuoteId}
            requisition={requisition}
            editingSupplierQuoteId={editingSupplierQuoteId}
            onClose={() => setEditingSupplierQuoteId(null)}
            onSaved={() => { void detail.refetch(); }}
          />
        </Suspense>
      )}
    </>
  );
};
