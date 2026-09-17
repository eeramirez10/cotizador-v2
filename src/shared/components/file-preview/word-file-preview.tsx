import { Alert, Box } from "@mui/material";

export const WordFilePreview = ({ html, warnings }: { html: string; warnings: string[] }) => (
  <Box sx={{ maxWidth: 920, mx: "auto", p: { xs: 2.5, md: 5 } }}>
    {warnings.length > 0 && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        El documento se abrió con {warnings.length} advertencia{warnings.length === 1 ? "" : "s"}; revisa el formato antes de usar la información.
      </Alert>
    )}
    <Box
      className="word-file-preview"
      sx={{
        minHeight: 500,
        bgcolor: "#ffffff",
        boxShadow: "0 1px 12px rgba(15, 23, 42, 0.10)",
        p: { xs: 3, md: 6 },
        color: "#172033",
        fontFamily: 'Georgia, "Times New Roman", serif',
        lineHeight: 1.65,
        "& img": { maxWidth: "100%", height: "auto" },
        "& table": { width: "100%", borderCollapse: "collapse", my: 2 },
        "& td, & th": { border: "1px solid #cbd5e1", p: 0.75, verticalAlign: "top" },
        "& p": { my: 1 },
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  </Box>
);
