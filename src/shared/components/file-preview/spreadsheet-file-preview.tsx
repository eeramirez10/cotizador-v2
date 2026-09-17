import { Alert, Box, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableRow, Typography } from "@mui/material";
import { useState } from "react";
import type { SpreadsheetPreviewSheet } from "./file-preview.types";

export const SpreadsheetFilePreview = ({ sheets, macroEnabled }: { sheets: SpreadsheetPreviewSheet[]; macroEnabled: boolean }) => {
  const [activeSheet, setActiveSheet] = useState(0);
  const selectedSheet = Math.min(activeSheet, Math.max(0, sheets.length - 1));
  const sheet = sheets[selectedSheet];

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column", bgcolor: "#ffffff" }}>
      {macroEnabled && <Alert severity="info" sx={{ borderRadius: 0 }}>Las macros no se ejecutan; el archivo se muestra únicamente como datos.</Alert>}
      {sheets.length > 1 && (
        <Tabs value={selectedSheet} onChange={(_, value: number) => setActiveSheet(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: "1px solid #e2e8f0", minHeight: 40 }}>
          {sheets.map((item) => <Tab key={item.name} label={item.name} sx={{ minHeight: 40, textTransform: "none", fontWeight: 700 }} />)}
        </Tabs>
      )}
      {!sheet ? (
        <Box sx={{ p: 4, textAlign: "center" }}><Typography color="text.secondary">El libro no contiene hojas visibles.</Typography></Box>
      ) : (
        <>
          {sheet.truncated && (
            <Alert severity="warning" sx={{ borderRadius: 0 }}>
              Vista limitada a 200 filas y 50 columnas. Hoja original: {sheet.totalRows} filas y {sheet.totalColumns} columnas.
            </Alert>
          )}
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader size="small" sx={{ minWidth: "max-content" }}>
              <TableBody>
                {sheet.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    <TableCell sx={{ position: "sticky", left: 0, zIndex: 2, minWidth: 52, bgcolor: "#f1f5f9", color: "#64748b", fontSize: 11, fontWeight: 700, borderRight: "1px solid #cbd5e1" }}>{rowIndex + 1}</TableCell>
                    {row.map((cell, columnIndex) => (
                      <TableCell key={columnIndex} sx={{ minWidth: 120, maxWidth: 340, whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12, bgcolor: rowIndex === 0 ? "#fff9d9" : "#ffffff", fontWeight: rowIndex === 0 ? 700 : 400 }}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}
    </Box>
  );
};
