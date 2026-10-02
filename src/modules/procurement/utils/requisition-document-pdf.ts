import type { PurchaseRequisition, RequisitionItem } from "../services/purchase-requisitions.service";

export type RequisitionDocumentKind = "COTIZACION" | "REQUISICION";

const selectedOffer = (item: RequisitionItem) =>
  item.offers.find((offer) => offer.isSelected)
  ?? item.offers.find((offer) => offer.source === "SELLER")
  ?? null;

const fileName = (value: string) => value.replace(/[^A-Za-z0-9_-]/g, "_");

export const downloadRequisitionDocument = async (requisition: PurchaseRequisition, kind: RequisitionDocumentKind) => {
  const items = requisition.items.filter((item) => item.quotationOwner === (kind === "COTIZACION" ? "SELLER" : "PURCHASING"));
  if (items.length === 0) throw new Error("No hay partidas para este documento.");
  const { jsPDF } = await import("jspdf");
  const logo = typeof window === "undefined" ? null : await fetch("/img/logo-tuvansa.png")
    .then(async (response) => response.ok ? new Uint8Array(await response.arrayBuffer()) : null)
    .catch(() => null);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const left = 24;
  const right = pageWidth - left;
  const widths = [24, 34, 31, 91, 157, 98, 80, 67, 74, 88];
  const labels = ["#", "CANT.", "UM", "ERP / PROV.", "DESCRIPCION", "DATOS TECNICOS", "PROVEEDOR", "COSTO REF.", "ENTREGA", "DESTINO"];
  const rowWidth = widths.reduce((sum, width) => sum + width, 0);
  const suppliers = [...new Set(items.map((item) => selectedOffer(item)?.supplier.name || item.sellerSupplierName).filter(Boolean))];
  const line = (value: string, x: number, y: number, maxWidth: number, size = 8) => {
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(value || "-", maxWidth);
    pdf.text(lines, x, y);
    return lines.length * (size + 2);
  };
  const drawHeader = () => {
    pdf.setTextColor(20, 34, 57);
    pdf.setFont("helvetica", "bold");
    if (logo) pdf.addImage(logo, "PNG", left, 18, 88, 29.5);
    else { pdf.setFontSize(16); pdf.text("TUVANSA", left, 39); }
    pdf.setFontSize(12);
    pdf.text("Solicitud de cotizacion y/o requisicion de compra", left, 60);
    pdf.setFontSize(8);
    pdf.text(`${kind === "COTIZACION" ? "[X]" : "[  ]"} COTIZACION    ${kind === "REQUISICION" ? "[X]" : "[  ]"} REQUISICION`, right, 39, { align: "right" });
    pdf.setFont("helvetica", "normal");
    pdf.text(`No. requisicion: ${requisition.requisitionNumber}`, left, 76);
    pdf.text(`Cotizacion cliente: ${requisition.quoteNumber}`, left + 255, 76);
    pdf.text(`Fecha: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(requisition.createdAt))}`, right, 76, { align: "right" });
    pdf.text(`Sucursal: ${requisition.branchName}  |  Cliente: ${requisition.customerName}`, left, 91);
    pdf.text(`Solicito: ${requisition.requestedBy.fullName}  |  Compras: ${requisition.assignedBuyer?.fullName || "Pendiente"}`, left, 105);
    pdf.text(`Direccion sucursal: ${requisition.branchAddress || "-"}${requisition.branchPhone ? `  |  Tel: ${requisition.branchPhone}` : ""}`.slice(0, 125), left, 119);
    pdf.text(`O.C. proveedor: ${requisition.supplierOrderReference || "-"}  |  Embarque: ${requisition.shipmentReference || "-"}`, left, 133);
    if (suppliers.length === 1) pdf.text(`Proveedor: ${suppliers[0]}`, right, 105, { align: "right" });
    pdf.setFillColor(25, 40, 63);
    pdf.rect(left, 145, rowWidth, 22, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    let x = left;
    labels.forEach((label, index) => {
      pdf.setFontSize(6.5);
      pdf.text(label, x + 4, 159);
      x += widths[index];
    });
    pdf.setTextColor(20, 34, 57);
    pdf.setFont("helvetica", "normal");
  };

  drawHeader();
  let y = 167;
  for (const item of items) {
    const offer = selectedOffer(item);
    const cost = offer?.unitCost ?? item.sellerUnitCost;
    const currency = offer?.currency ?? item.sellerCurrency;
    const technical = [item.standard, item.diameter, item.thickness, item.bore, item.originRestrictions.length ? `Origen: ${item.originRestrictions.join(", ")}` : null].filter(Boolean).join(" / ");
    const code = `${item.erpEan || item.erpCode || "PENDIENTE ERP"}${offer?.supplierProductCode ? `\nProv: ${offer.supplierProductCode}` : ""}`;
    const price = cost > 0 && (kind === "COTIZACION" || offer) ? `${currency} ${cost.toFixed(2)}` : "PENDIENTE";
    const provider = `${offer?.supplier.name || item.sellerSupplierName || "Pendiente"}${offer?.externalReference ? `\nRef: ${offer.externalReference}` : ""}${offer?.brand || item.sellerBrand ? `\n${offer?.brand || item.sellerBrand}` : ""}`;
    const delivery = `${offer?.deliveryTime || item.sellerDeliveryTime || "Pendiente"}${offer?.deliveryTime && item.sellerDeliveryTime && offer.deliveryTime.trim().toUpperCase() !== item.sellerDeliveryTime.trim().toUpperCase() ? `\nSolicitado: ${item.sellerDeliveryTime}` : ""}`;
    const values = [
      String(item.position), String(item.qty), item.unit, code, item.description,
      technical || "-", provider,
      price, delivery, item.deliveryPlace || requisition.deliveryState || "-",
    ];
    const heights = values.map((value, index) => pdf.splitTextToSize(value, widths[index] - 8).length * 9 + 10);
    const height = Math.max(33, ...heights);
    if (y + height > pageHeight - 125) {
      pdf.addPage("letter", "landscape");
      drawHeader();
      y = 167;
    }
    let x = left;
    values.forEach((value, index) => {
      pdf.setDrawColor(210, 217, 226);
      pdf.rect(x, y, widths[index], height);
      line(value, x + 4, y + 12, widths[index] - 8, 7);
      x += widths[index];
    });
    y += height;
  }

  if (y > pageHeight - 133) {
    pdf.addPage("letter", "landscape");
    drawHeader();
    y = 171;
  }
  y += 14;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.text("TERMINOS Y CONDICIONES", left, y);
  pdf.setFont("helvetica", "normal");
  y += 13;
  y += line(`Certificados de calidad: ${requisition.qualityCertificatesRequired ? "Requeridos" : "No indicados"}  |  Marcas / colada: ${requisition.markingInstructions || "-"}`, left, y, rowWidth, 8);
  y += line(`L.A.B. / FOB: ${requisition.fobTerms || "-"}  |  Condiciones de pago: ${requisition.paymentTerms || "-"}`, left, y, rowWidth, 8);
  pdf.setDrawColor(90, 104, 124);
  pdf.line(left, pageHeight - 57, left + 220, pageHeight - 57);
  pdf.line(right - 220, pageHeight - 57, right, pageHeight - 57);
  pdf.text(`Vendedor: ${requisition.requestedBy.fullName}`, left, pageHeight - 44);
  pdf.text(`Compras: ${requisition.assignedBuyer?.fullName || "Pendiente"}`, right - 220, pageHeight - 44);
  pdf.setFontSize(7);
  pdf.text("Documento generado por el sistema. Las lineas anteriores son espacios para firma; no implican firma electronica.", left, pageHeight - 22);
  pdf.save(`${kind === "COTIZACION" ? "Solicitud-Cotizacion" : "Requisicion-Compra"}-${fileName(requisition.requisitionNumber)}.pdf`);
};
