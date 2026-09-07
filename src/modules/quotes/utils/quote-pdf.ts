const waitForPdfImages = async (root: HTMLElement): Promise<void> => {
  const images = Array.from(root.querySelectorAll("img"));
  await Promise.all(images.map((image) => new Promise<void>((resolve) => {
    if (image.complete && image.naturalWidth > 0) return resolve();
    const done = () => resolve();
    image.addEventListener("load", done, { once: true });
    image.addEventListener("error", done, { once: true });
    window.setTimeout(done, 3000);
  })));
};

const safeQuoteFileName = (quoteNumber: string): string => {
  const safeName = quoteNumber
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return `${safeName || "cotizacion"}.pdf`;
};

export const createQuotePdfFile = async (printable: HTMLElement, quoteNumber: string): Promise<File> => {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
  if ("fonts" in document) await document.fonts.ready;
  await waitForPdfImages(printable);

  const rootRect = printable.getBoundingClientRect();
  const rowBreaksDom = Array.from(printable.querySelectorAll("tbody tr"))
    .map((row) => (row as HTMLElement).getBoundingClientRect().top - rootRect.top)
    .filter((top) => Number.isFinite(top) && top > 0)
    .sort((left, right) => left - right);
  const canvas = await html2canvas(printable, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    windowWidth: printable.scrollWidth,
    windowHeight: printable.scrollHeight,
  });
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const marginTop = 26;
  const marginBottom = 20;
  const marginX = 18;
  const contentWidth = pageWidth - marginX * 2;
  const contentHeight = pdf.internal.pageSize.getHeight() - marginTop - marginBottom;
  const imageHeight = (canvas.height * contentWidth) / canvas.width;
  const domToPdfFactor = imageHeight / Math.max(printable.scrollHeight, 1);
  const rowBreaksPdf = rowBreaksDom.map((value) => value * domToPdfFactor);
  const pxPerPdfUnit = canvas.height / Math.max(imageHeight, 1);
  let currentOffset = 0;
  let pageIndex = 0;

  while (currentOffset < imageHeight - 0.5) {
    const tentativeEnd = Math.min(currentOffset + contentHeight, imageHeight);
    const candidates = rowBreaksPdf.filter(
      (value) => value > currentOffset + 130 && value <= tentativeEnd - 4,
    );
    const nextOffset = candidates.length > 0 ? candidates[candidates.length - 1] : tentativeEnd;
    const safeNextOffset = nextOffset > currentOffset + 4 ? nextOffset : tentativeEnd;
    const chunkHeightPdf = safeNextOffset - currentOffset;
    if (chunkHeightPdf <= 0) break;
    if (pageIndex > 0) pdf.addPage("letter", "portrait");

    const sourceY = Math.floor(currentOffset * pxPerPdfUnit);
    const sourceHeight = Math.max(1, Math.ceil(chunkHeightPdf * pxPerPdfUnit));
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sourceHeight;
    const pageContext = pageCanvas.getContext("2d");
    if (!pageContext) throw new Error("No se pudo preparar el contexto de imagen para PDF.");
    pageContext.drawImage(canvas, 0, sourceY, canvas.width, sourceHeight, 0, 0, canvas.width, sourceHeight);
    pdf.addImage(
      pageCanvas.toDataURL("image/jpeg", 0.96),
      "JPEG",
      marginX,
      marginTop,
      contentWidth,
      sourceHeight / pxPerPdfUnit,
      undefined,
      "FAST",
    );
    currentOffset = safeNextOffset;
    pageIndex += 1;
  }

  return new File([pdf.output("blob")], safeQuoteFileName(quoteNumber), { type: "application/pdf" });
};

export const downloadQuotePdfFile = (file: File): void => {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
