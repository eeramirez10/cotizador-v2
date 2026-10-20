import type { PurchaseRequisition, SupplierRequisition } from "../services/purchase-requisitions.service";
import { preferredRequisitionOffer, requisitionItemSupplierDescription, requisitionItemSupplierName } from "./requisition-supplier-display";

export type RequisitionDocumentKind = "COTIZACION" | "REQUISICION";

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
  const labels = ["#", "CANT.", "UM", "ERP / PROV.", "DESCRIPCIONES", "DATOS TECNICOS", "PROVEEDOR", "COSTO REF.", "ENTREGA", "DESTINO"];
  const rowWidth = widths.reduce((sum, width) => sum + width, 0);
  const suppliers = [...new Set(items.map(requisitionItemSupplierName).filter((name): name is string => Boolean(name)))];
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
    if (suppliers.length > 1) pdf.text(`${suppliers.length} proveedores (ver partidas)`, right, 105, { align: "right" });
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
    const offer = preferredRequisitionOffer(item);
    const cost = offer?.unitCost ?? item.sellerUnitCost;
    const currency = offer?.currency ?? item.sellerCurrency;
    const technical = [item.standard, item.diameter, item.thickness, item.bore, item.originRestrictions.length ? `Origen: ${item.originRestrictions.join(", ")}` : null].filter(Boolean).join(" / ");
    const code = `${item.erpEan || item.erpCode || "PENDIENTE ERP"}${offer?.supplierProductCode ? `\nProv: ${offer.supplierProductCode}` : ""}`;
    const price = cost > 0 && (kind === "COTIZACION" || offer) ? `${currency} ${cost.toFixed(2)}` : "PENDIENTE";
    const provider = `${requisitionItemSupplierName(item) || "Sin asignar"}${offer?.source === "PURCHASING" && !offer.isSelected ? "\nPropuesta sin adjudicar" : ""}${offer?.externalReference ? `\nRef: ${offer.externalReference}` : ""}${offer?.brand || item.sellerBrand ? `\n${offer?.brand || item.sellerBrand}` : ""}`;
    const delivery = `${offer?.deliveryTime || item.sellerDeliveryTime || "Pendiente"}${offer?.deliveryTime && item.sellerDeliveryTime && offer.deliveryTime.trim().toUpperCase() !== item.sellerDeliveryTime.trim().toUpperCase() ? `\nSolicitado: ${item.sellerDeliveryTime}` : ""}`;
    const descriptions = `Cliente: ${item.customerDescription || "No capturada"}\nERP: ${item.erpDescription || "-"}\nDescripcion proveedor: ${requisitionItemSupplierDescription(item) || "No capturada"}`;
    const values = [
      String(item.position), String(item.qty), item.unit, code, descriptions,
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

export const downloadSupplierRequisition = async (requisition: PurchaseRequisition, document: SupplierRequisition) => {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "letter" });
  const money = (value: number) => new Intl.NumberFormat("es-MX", { style: "currency", currency: document.currency }).format(value);
  const maxY = pdf.internal.pageSize.getHeight() - 65;
  const drawHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.text("TUVANSA | REQUISICION DE COMPRA", 28, 40);
    pdf.setFontSize(10);
    pdf.text(document.number, 28, 60);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Proveedor: ${document.supplierName}`, 28, 78);
    pdf.text(`Cotizacion cliente: ${requisition.quoteNumber}`, 28, 94);
    pdf.text(`Moneda de compra: ${document.currency}`, 595, 60);
    pdf.text(`Fecha: ${new Intl.DateTimeFormat("es-MX", { dateStyle: "short" }).format(new Date(document.createdAt))}`, 595, 78);
    pdf.setFillColor(24, 34, 50);
    pdf.rect(28, 110, 735, 25, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.text("PART.", 34, 126);
    pdf.text("CANT.", 83, 126);
    pdf.text("UM", 132, 126);
    pdf.text("CODIGO ERP / PROVEEDOR", 168, 126);
    pdf.text("DESCRIPCION", 331, 126);
    pdf.text("COSTO UNIT.", 592, 126);
    pdf.text("TOTAL", 692, 126);
    pdf.setTextColor(24, 34, 50);
    pdf.setFont("helvetica", "normal");
  };
  drawHeader();
  let y = 151;
  for (const item of document.lines) {
    const description = pdf.splitTextToSize(item.description, 240) as string[];
    const height = Math.max(29, description.length * 10 + 12);
    if (y + height > maxY) { pdf.addPage("letter", "landscape"); drawHeader(); y = 151; }
    pdf.setDrawColor(210, 218, 226);
    pdf.rect(28, y - 12, 735, height);
    pdf.setFontSize(8);
    pdf.text(String(item.position), 34, y);
    pdf.text(String(item.qty), 83, y);
    pdf.text(item.unit, 132, y);
    pdf.text(pdf.splitTextToSize(`${item.erpCode || "Alta ERP pendiente"}\n${item.supplierProductCode || ""}`, 150), 168, y);
    pdf.text(description, 331, y);
    pdf.text(money(item.unitCost), 592, y);
    pdf.text(money(item.total), 692, y);
    y += height;
  }
  const subtotal = document.lines.reduce((sum, line) => sum + line.subtotal, 0);
  const tax = document.lines.reduce((sum, line) => sum + line.tax, 0);
  if (y + 54 > maxY) { pdf.addPage("letter", "landscape"); drawHeader(); y = 151; }
  pdf.setFont("helvetica", "bold");
  pdf.text(`Subtotal: ${money(subtotal)}`, 590, y + 15);
  pdf.text(`IVA: ${money(tax)}`, 590, y + 30);
  pdf.text(`Total: ${money(subtotal + tax)}`, 590, y + 45);
  pdf.save(`Requisicion-${fileName(document.number)}-${document.currency}.pdf`);
};
