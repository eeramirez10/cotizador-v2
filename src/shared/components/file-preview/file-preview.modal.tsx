import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from "@mui/material";
import { Download, X } from "lucide-react";
import { useState } from "react";
import { FilePreviewService } from "./file-preview.service";
import { FileTypeIcon } from "./file-type-icon";
import type { PreviewableFile } from "./file-preview.types";
import { SpreadsheetFilePreview } from "./spreadsheet-file-preview";
import { useFilePreview } from "./use-file-preview";
import { WordFilePreview } from "./word-file-preview";
import { notifier } from "../../notifications/notifier";

export const FilePreviewModal = ({
  file,
  onClose,
  getBlob,
  downloadFile,
}: {
  file: PreviewableFile | null;
  onClose: () => void;
  getBlob: (file: PreviewableFile) => Promise<Blob>;
  downloadFile: (file: PreviewableFile) => Promise<void>;
}) => {
  const { preview, loading, error } = useFilePreview({ file, getBlob });
  const [downloading, setDownloading] = useState(false);
  const colors = FilePreviewService.colors(file || { id: "", originalName: "", mimeType: "" });

  const download = async () => {
    if (!file) return;
    setDownloading(true);
    try {
      await downloadFile(file);
    } catch (caught) {
      notifier.error(caught instanceof Error ? caught.message : "No se pudo descargar el archivo.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={Boolean(file)}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{ sx: { height: { xs: "100%", sm: "94vh" }, maxHeight: { xs: "100%", sm: "94vh" }, m: { xs: 0, sm: 2 }, borderRadius: { xs: 0, sm: 2 } } }}
    >
      {file && (
        <>
          <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1.25, py: 1.5, pr: 1.5 }}>
            <Box sx={{ display: "grid", placeItems: "center", width: 38, height: 38, borderRadius: 1.5, bgcolor: colors.background, color: colors.foreground, flexShrink: 0 }}>
              <FileTypeIcon file={file} />
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="overline" fontWeight={800} color="text.secondary">Vista previa {FilePreviewService.typeLabel(file)}</Typography>
              <Typography variant="subtitle1" fontWeight={800} noWrap title={file.originalName}>{file.originalName}</Typography>
            </Box>
            <IconButton onClick={onClose} aria-label="Cerrar visor"><X size={20} /></IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ p: 0, bgcolor: "#e9eef4", minHeight: 0 }}>
            {loading && (
              <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: "100%", minHeight: 320 }}>
                <CircularProgress size={32} sx={{ color: "#d4a900" }} />
                <Typography variant="body2" color="text.secondary">Preparando vista previa...</Typography>
              </Stack>
            )}
            {!loading && error && (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", minHeight: 320, p: 3 }}>
                <Alert severity="error" sx={{ maxWidth: 560 }}>{error}</Alert>
              </Stack>
            )}
            {!loading && !error && preview?.kind === "pdf" && <iframe src={preview.objectUrl} title={`Vista previa de ${file.originalName}`} style={{ display: "block", width: "100%", height: "100%", minHeight: "70vh", border: 0, background: "white" }} />}
            {!loading && !error && preview?.kind === "image" && <Box sx={{ height: "100%", minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", overflow: "auto", p: 2 }}><Box component="img" src={preview.objectUrl} alt={file.originalName} sx={{ maxWidth: "100%", maxHeight: "calc(94vh - 150px)", objectFit: "contain" }} /></Box>}
            {!loading && !error && preview?.kind === "word" && <Box sx={{ height: "100%", overflow: "auto" }}><WordFilePreview html={preview.html} warnings={preview.warnings} /></Box>}
            {!loading && !error && preview?.kind === "spreadsheet" && <SpreadsheetFilePreview sheets={preview.sheets} macroEnabled={preview.macroEnabled} />}
            {!loading && !error && preview?.kind === "unsupported" && (
              <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 360, p: 3, textAlign: "center" }}>
                <Box sx={{ display: "grid", placeItems: "center", width: 58, height: 58, borderRadius: 2, bgcolor: colors.background, color: colors.foreground }}><FileTypeIcon file={file} size={28} /></Box>
                <Typography variant="subtitle1" fontWeight={800}>Vista previa no disponible</Typography>
                <Typography variant="body2" color="text.secondary" maxWidth={520}>{preview.reason}</Typography>
              </Stack>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 2, py: 1.25 }}>
            <Button onClick={onClose} color="inherit">Cerrar</Button>
            <Button variant="contained" onClick={() => void download()} disabled={downloading} startIcon={downloading ? <CircularProgress size={15} color="inherit" /> : <Download size={16} />} sx={{ bgcolor: "#172033", "&:hover": { bgcolor: "#26334d" } }}>
              Descargar original
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};
