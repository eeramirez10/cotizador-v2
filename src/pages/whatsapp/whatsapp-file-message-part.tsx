import { Box, Button, ButtonBase, CircularProgress, Stack, Typography } from "@mui/material";
import { CheckCircle2, RefreshCw, Sparkles } from "lucide-react";
import { FactCheckOutlined, PictureAsPdfOutlined, SendOutlined } from "@mui/icons-material";
import type { WhatsAppInboundAttachment } from "../../modules/whatsapp/services/whatsapp-inbox.service";
import { FilePreviewService } from "../../shared/components/file-preview/file-preview.service";
import { FileTypeIcon } from "../../shared/components/file-preview/file-type-icon";

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const WhatsAppFileMessagePart = ({
  attachment,
  onOpen,
  onGenerateQuote,
  onExtractTaxDocument,
  onSubmitForCxc,
  onReviewOnboarding,
  fiscalDocument = false,
  taxDocumentExtracted = false,
  extractingTaxDocument = false,
  submittingForCxc = false,
  cxcSubmitted = false,
  missingFiscalFields = false,
  generateQuoteDisabledReason,
  generating = false,
}: {
  attachment: WhatsAppInboundAttachment;
  onOpen: () => void;
  onGenerateQuote?: () => void;
  onExtractTaxDocument?: () => void;
  onSubmitForCxc?: () => void;
  onReviewOnboarding?: () => void;
  fiscalDocument?: boolean;
  taxDocumentExtracted?: boolean;
  extractingTaxDocument?: boolean;
  submittingForCxc?: boolean;
  cxcSubmitted?: boolean;
  missingFiscalFields?: boolean;
  generateQuoteDisabledReason?: string;
  generating?: boolean;
}) => {
  const colors = FilePreviewService.colors(attachment);
  const alreadyExtracted = attachment.quoteExtractionCount > 0;
  const extractedAt = attachment.quoteExtractedAt
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "short", timeStyle: "short" }).format(new Date(attachment.quoteExtractedAt))
    : null;
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 340,
        mt: 0.75,
        border: "1px solid rgba(100, 116, 139, 0.24)",
        borderRadius: 1.5,
        bgcolor: "rgba(255,255,255,0.72)",
        overflow: "hidden",
      }}
    >
      <ButtonBase
        onClick={onOpen}
        aria-label={`Abrir ${attachment.originalName}`}
        sx={{
          display: "flex",
          width: "100%",
          justifyContent: "flex-start",
          gap: 1.15,
          p: 1,
          textAlign: "left",
          transition: "background-color 140ms ease",
          "&:hover": { bgcolor: "#ffffff" },
        }}
      >
        <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 1.25, bgcolor: colors.background, color: colors.foreground, flexShrink: 0 }}>
          <FileTypeIcon file={attachment} />
        </Box>
        <Stack minWidth={0} flex={1}>
          <Typography variant="body2" fontWeight={800} noWrap title={attachment.originalName}>{attachment.originalName}</Typography>
          <Typography variant="caption" color="text.secondary">
            {FilePreviewService.typeLabel(attachment)} · {formatBytes(attachment.sizeBytes)}
          </Typography>
        </Stack>
      </ButtonBase>
      {!fiscalDocument && alreadyExtracted && (
        <Stack
          direction="row"
          spacing={0.75}
          alignItems="flex-start"
          sx={{ mx: 1, mb: 0.75, p: 0.8, borderRadius: 1.25, bgcolor: "#ecfdf5", color: "#047857" }}
        >
          <CheckCircle2 size={15} style={{ marginTop: 1, flexShrink: 0 }} />
          <Box minWidth={0}>
            <Typography variant="caption" fontWeight={850} component="p">Partidas extraídas</Typography>
            <Typography variant="caption" component="p" sx={{ color: "#477466", lineHeight: 1.25 }}>
              {extractedAt ? `${extractedAt}${attachment.quoteExtractedByName ? ` · ${attachment.quoteExtractedByName}` : ""}` : "Archivo procesado"}
            </Typography>
          </Box>
        </Stack>
      )}
      {fiscalDocument && taxDocumentExtracted && (
        <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mx: 1, mb: 0.75, p: 0.8, borderRadius: 1.25, bgcolor: "#eef6ff", color: "#1759a2" }}>
          <FactCheckOutlined sx={{ fontSize: 16 }} />
          <Typography variant="caption" fontWeight={700}>Datos fiscales extraídos</Typography>
        </Stack>
      )}
      <Box sx={{ px: 1, pb: 1 }}>
        {!fiscalDocument && <Button
          fullWidth
          size="small"
          variant="outlined"
          disabled={generating || !onGenerateQuote}
          onClick={onGenerateQuote}
          title={generateQuoteDisabledReason}
          startIcon={generating
            ? <CircularProgress size={14} color="inherit" />
            : alreadyExtracted
              ? <RefreshCw size={15} />
              : <Sparkles size={15} />}
          sx={{
            minHeight: 30,
            borderColor: "#d4a900",
            color: "#6b5200",
            bgcolor: "#fff9d9",
            fontWeight: 800,
            textTransform: "none",
            "&:hover": { borderColor: "#b89000", bgcolor: "#fff3a3" },
          }}
        >
          {generating
            ? "Extrayendo partidas..."
            : generateQuoteDisabledReason || (alreadyExtracted ? "Procesar otra vez" : "Generar cotización")}
        </Button>}
        {onExtractTaxDocument && (
          <Button
            fullWidth
            size="small"
            variant="outlined"
            disabled={extractingTaxDocument}
            onClick={onExtractTaxDocument}
            startIcon={extractingTaxDocument ? <CircularProgress size={14} color="inherit" /> : <PictureAsPdfOutlined sx={{ fontSize: 17 }} />}
            sx={{ mt: fiscalDocument ? 0 : 0.75, minHeight: 30, borderColor: "#a9c6e8", color: "#1759a2", bgcolor: "#f2f8ff", fontWeight: 700, textTransform: "none" }}
          >
            {extractingTaxDocument ? "Extrayendo datos fiscales..." : taxDocumentExtracted ? "Procesar constancia otra vez" : "Extraer datos de constancia"}
          </Button>
        )}
        {fiscalDocument && taxDocumentExtracted && onReviewOnboarding && (
          <Button fullWidth size="small" variant="text" onClick={onReviewOnboarding} sx={{ mt: 0.5 }}>
            {missingFiscalFields ? "Completar expediente fiscal" : "Revisar datos fiscales"}
          </Button>
        )}
        {fiscalDocument && taxDocumentExtracted && !cxcSubmitted && onSubmitForCxc && (
          <Button fullWidth size="small" variant="contained" color="primary" disabled={submittingForCxc || missingFiscalFields} onClick={onSubmitForCxc} startIcon={submittingForCxc ? <CircularProgress size={14} color="inherit" /> : <SendOutlined sx={{ fontSize: 16 }} />} sx={{ mt: 0.5 }}>
            {submittingForCxc ? "Enviando..." : "Enviar a CxC"}
          </Button>
        )}
        {fiscalDocument && taxDocumentExtracted && cxcSubmitted && (
          <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 0.5, textAlign: "center" }}>Expediente enviado a CxC</Typography>
        )}
      </Box>
    </Box>
  );
};
