import {
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { Search, UserRoundCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { type ManagedUser, UsersService } from "../../modules/users/services/users.service";

interface AssignWhatsAppLeadModalProps {
  open: boolean;
  currentSellerId: string | null;
  onClose: () => void;
  onAssign: (seller: ManagedUser) => Promise<void>;
}

const initials = (value: string): string =>
  value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export const AssignWhatsAppLeadModal = ({
  open,
  currentSellerId,
  onClose,
  onAssign,
}: AssignWhatsAppLeadModalProps) => {
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setUsers([]);
      setError(null);
      return;
    }
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void UsersService.list({ page: 1, pageSize: 100, search: query.trim() || undefined })
        .then((result) => {
          if (!cancelled) setUsers(result.items.filter((user) => user.isActive && user.role === "SELLER"));
        })
        .catch((caught) => {
          if (!cancelled) setError(caught instanceof Error ? caught.message : "No se pudieron cargar los vendedores.");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => left.fullName.localeCompare(right.fullName, "es")),
    [users],
  );

  const assign = async (seller: ManagedUser) => {
    setAssigningId(seller.id);
    setError(null);
    try {
      await onAssign(seller);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo asignar el prospecto.");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Dialog open={open} onClose={assigningId ? undefined : onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ pb: 1 }}>
        <Typography component="span" variant="h6" fontWeight={800}>Asignar prospecto</Typography>
        <Typography component="p" variant="body2" color="text.secondary" mt={0.5}>
          Selecciona al vendedor que continuará la conversación.
        </Typography>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar por nombre, usuario o correo"
          slotProps={{ input: { startAdornment: <Search size={17} style={{ marginRight: 8, color: "#64748b" }} /> } }}
          sx={{ mt: 1 }}
        />
        <Box sx={{ mt: 2, minHeight: 220, maxHeight: 360, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 2 }}>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 1, py: 7 }}>
              <CircularProgress size={20} /><Typography variant="body2">Buscando vendedores...</Typography>
            </Box>
          )}
          {!loading && error && <Typography color="error" variant="body2" sx={{ p: 2 }}>{error}</Typography>}
          {!loading && !error && sortedUsers.length === 0 && (
            <Typography color="text.secondary" variant="body2" sx={{ p: 3, textAlign: "center" }}>
              No se encontraron vendedores disponibles.
            </Typography>
          )}
          {!loading && !error && (
            <List disablePadding>
              {sortedUsers.map((seller) => (
                <ListItemButton
                  key={seller.id}
                  disabled={Boolean(assigningId)}
                  selected={seller.id === currentSellerId}
                  onClick={() => void assign(seller)}
                  sx={{ borderBottom: "1px solid #f1f5f9", py: 1.25 }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 36, height: 36, bgcolor: "#172033", fontSize: 12, fontWeight: 800 }}>
                      {initials(seller.fullName)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={seller.fullName}
                    secondary={`${seller.branch.name} · ${seller.email}`}
                    primaryTypographyProps={{ fontWeight: 750, fontSize: 14 }}
                    secondaryTypographyProps={{ fontSize: 12 }}
                  />
                  {assigningId === seller.id
                    ? <CircularProgress size={18} />
                    : seller.id === currentSellerId
                      ? <UserRoundCheck size={19} color="#0f766e" />
                      : null}
                </ListItemButton>
              ))}
            </List>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={Boolean(assigningId)} variant="outlined">Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
};
