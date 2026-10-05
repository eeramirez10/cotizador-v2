import { DragDropProvider } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import { move } from "@dnd-kit/helpers";
import { DragIndicator, KeyboardArrowDown, KeyboardArrowUp } from "@mui/icons-material";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { useState } from "react";

export interface QuoteItemOrderEntry {
  id: string;
  customerDescription?: string | null;
  erpDescription?: string | null;
  erpCode?: string | null;
  localProductId?: string | null;
  qty: number;
  unit: string;
}

interface QuoteItemOrderModalProps {
  open: boolean;
  items: QuoteItemOrderEntry[];
  saveHint?: string;
  saving: boolean;
  onClose: () => void;
  onSave: (ids: string[]) => Promise<void>;
}

const SortableQuoteItem = ({
  item,
  index,
  count,
  onMove,
}: {
  item: QuoteItemOrderEntry;
  index: number;
  count: number;
  onMove: (index: number, offset: number) => void;
}) => {
  const { ref, handleRef, isDragging } = useSortable({ id: item.id, index });
  const description = item.customerDescription || item.erpDescription || "Partida sin descripción";
  const code = item.erpCode || (item.localProductId ? "Local" : "Sin vincular");

  return (
    <Box
      ref={ref}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        px: 0.75,
        py: 0.25,
        minHeight: 38,
        border: "1px solid",
        borderColor: isDragging ? "warning.main" : "divider",
        borderRadius: 1,
        bgcolor: isDragging ? "#fff8e1" : "background.paper",
        boxShadow: isDragging ? 2 : 0,
      }}
    >
      <IconButton
        ref={handleRef}
        size="small"
        aria-label={`Arrastrar partida ${index + 1}: ${description}`}
        sx={{ cursor: "grab", touchAction: "none", p: 0.375 }}
      >
        <DragIndicator fontSize="small" />
      </IconButton>
      <Typography variant="caption" color="text.secondary" sx={{ width: 22, flexShrink: 0, textAlign: "center" }}>
        {index + 1}
      </Typography>
      <Box sx={{ minWidth: 0, flex: 1, display: "flex", alignItems: "center", gap: 1 }}>
        <Typography variant="body2" noWrap title={description} sx={{ minWidth: 0, flex: 1, fontSize: "0.78rem" }}>
          {description}
        </Typography>
        <Typography variant="caption" noWrap title={code} color="text.secondary" sx={{ width: { xs: 72, sm: 104 }, flexShrink: 0, fontSize: "0.7rem" }}>
          {code}
        </Typography>
        <Typography variant="caption" noWrap color="text.secondary" sx={{ width: 65, flexShrink: 0, textAlign: "right", fontSize: "0.7rem" }}>
          {item.qty} {item.unit}
        </Typography>
      </Box>
      <IconButton size="small" sx={{ p: 0.375 }} disabled={index === 0} onClick={() => onMove(index, -1)} aria-label={`Subir partida ${index + 1}`}>
        <KeyboardArrowUp fontSize="small" />
      </IconButton>
      <IconButton size="small" sx={{ p: 0.375 }} disabled={index === count - 1} onClick={() => onMove(index, 1)} aria-label={`Bajar partida ${index + 1}`}>
        <KeyboardArrowDown fontSize="small" />
      </IconButton>
    </Box>
  );
};

export const QuoteItemOrderModal = ({ open, items, saving, onClose, onSave, saveHint = "Arrastra las partidas o usa las flechas. Al guardar el orden también se guardarán los demás cambios del borrador." }: QuoteItemOrderModalProps) => {
  const [orderedIds, setOrderedIds] = useState<string[]>(() => items.map((item) => item.id));

  const byId = new Map(items.map((item) => [item.id, item]));
  const hasChanges = orderedIds.some((id, index) => id !== items[index]?.id);
  const moveOne = (index: number, offset: number) => {
    setOrderedIds((current) => {
      const next = [...current];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm" aria-labelledby="quote-order-title">
      <DialogTitle id="quote-order-title" sx={{ pb: 0.5 }}>Ordenar partidas</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {saveHint}
        </Typography>
        <DragDropProvider onDragEnd={(event) => {
          if (!event.canceled) setOrderedIds((current) => move(current, event));
        }}>
          <Box sx={{ display: "grid", gap: 0.5, maxHeight: "min(72vh, 740px)", overflowY: "auto", pr: 0.5 }}>
            {orderedIds.map((id, index) => {
              const item = byId.get(id);
              return item ? <SortableQuoteItem key={id} item={item} index={index} count={orderedIds.length} onMove={moveOne} /> : null;
            })}
          </Box>
        </DragDropProvider>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose} disabled={saving}>Cancelar</Button>
        <Button variant="contained" onClick={() => void onSave(orderedIds)} disabled={saving || !hasChanges}>
          {saving ? "Guardando..." : "Guardar orden"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
