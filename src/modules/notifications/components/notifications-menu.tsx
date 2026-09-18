import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import {
  Avatar,
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemAvatar,
  ListItemButton,
  ListItemText,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import { notifier } from "../../../shared/notifications/notifier";
import { useAppNotifications } from "../context/app-notifications.context";
import type { AppNotification } from "../types/app-notification.types";

const formatOccurredAt = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit" }).format(date);
  }
  return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(date);
};

export const NotificationsMenu = () => {
  const navigate = useNavigate();
  const { enabled, items, loading, unreadCount, markRead } = useAppNotifications();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const open = Boolean(anchorEl);

  const openMenu = (event: MouseEvent<HTMLElement>): void => setAnchorEl(event.currentTarget);
  const closeMenu = (): void => setAnchorEl(null);

  const openNotification = async (notification: AppNotification): Promise<void> => {
    closeMenu();
    navigate(notification.href);
    if (notification.unreadCount === 0) return;
    try {
      await markRead(notification);
    } catch (error) {
      notifier.error(error instanceof Error ? error.message : "No se pudo marcar la notificación como leída.");
    }
  };

  return (
    <>
      <IconButton
        type="button"
        aria-label={unreadCount > 0 ? `${unreadCount} notificaciones sin leer` : "Notificaciones"}
        aria-controls={open ? "app-notifications-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={openMenu}
        sx={{
          width: 40,
          height: 40,
          color: "#475569",
          border: "1px solid transparent",
          "&:hover": { bgcolor: "#f8fafc", borderColor: "#e2e8f0" },
        }}
      >
        <Badge
          badgeContent={enabled ? unreadCount : 0}
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              bgcolor: "#fcce01",
              color: "#111827",
              minWidth: 18,
              height: 18,
              px: 0.5,
              fontSize: "0.65rem",
              fontWeight: 700,
              border: "2px solid #ffffff",
            },
          }}
        >
          <NotificationsOutlinedIcon sx={{ fontSize: 23 }} />
        </Badge>
      </IconButton>

      <Popover
        id="app-notifications-menu"
        open={open}
        anchorEl={anchorEl}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: { xs: "calc(100vw - 24px)", sm: 390 },
              maxWidth: 390,
              maxHeight: 520,
              borderRadius: 2.5,
              border: "1px solid #e2e8f0",
              boxShadow: "0 20px 48px rgba(15, 23, 42, 0.16)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2, py: 1.5 }}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: "#172033", fontWeight: 700 }}>
              Notificaciones
            </Typography>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              {unreadCount > 0 ? `${unreadCount} notificación${unreadCount === 1 ? "" : "es"} sin leer` : "Todo está al día"}
            </Typography>
          </Box>
          {loading && <CircularProgress size={19} sx={{ color: "#d4a900" }} />}
        </Stack>
        <Divider />

        {!enabled ? (
          <Box sx={{ px: 3, py: 4, textAlign: "center" }}>
            <NotificationsOutlinedIcon sx={{ fontSize: 32, color: "#94a3b8" }} />
            <Typography variant="body2" sx={{ mt: 1, color: "#64748b" }}>
              Las notificaciones de WhatsApp no están habilitadas.
            </Typography>
          </Box>
        ) : items.length === 0 && !loading ? (
          <Box sx={{ px: 3, py: 4, textAlign: "center" }}>
            <NotificationsOutlinedIcon sx={{ fontSize: 32, color: "#94a3b8" }} />
            <Typography variant="body2" sx={{ mt: 1, color: "#64748b" }}>
              Aún no tienes notificaciones recientes.
            </Typography>
          </Box>
        ) : (
          <List disablePadding sx={{ maxHeight: 380, overflowY: "auto" }}>
            {items.slice(0, 12).map((notification, index) => {
              const unread = notification.unreadCount > 0;
              const accepted = notification.kind === "QUOTE_ACCEPTED";
              const rejected = notification.kind === "QUOTE_REJECTED";
              const quoteNotification = notification.source === "QUOTE";
              const informationRequest = notification.kind === "CUSTOMER_INFORMATION_REQUESTED";
              const changeRequest = notification.kind === "CUSTOMER_CHANGE_REQUESTED";
              return (
                <Box key={notification.id}>
                  <ListItemButton
                    onClick={() => void openNotification(notification)}
                    sx={{
                      alignItems: "flex-start",
                      gap: 0.5,
                      px: 2,
                      py: 1.35,
                      bgcolor: unread ? "#fffbea" : "#ffffff",
                      "&:hover": { bgcolor: unread ? "#fff6c7" : "#f8fafc" },
                    }}
                  >
                    <ListItemAvatar sx={{ minWidth: 46, mt: 0.15 }}>
                      <Avatar sx={{
                        width: 36,
                        height: 36,
                        bgcolor: !quoteNotification ? "#e8f8ef" : accepted ? "#e9f9ef" : rejected ? "#fff7dd" : informationRequest ? "#e0f2fe" : changeRequest ? "#ede9fe" : "#fff0f0",
                        color: !quoteNotification ? "#128c4a" : accepted ? "#17864b" : rejected ? "#a16207" : informationRequest ? "#0369a1" : changeRequest ? "#6d28d9" : "#c43d3d",
                      }}>
                        {!quoteNotification && <WhatsAppIcon sx={{ fontSize: 19 }} />}
                        {accepted && <CheckCircleOutlineIcon sx={{ fontSize: 20 }} />}
                        {rejected && <ReportProblemOutlinedIcon sx={{ fontSize: 20 }} />}
                        {notification.kind === "QUOTE_CANCELLED" && <CancelOutlinedIcon sx={{ fontSize: 20 }} />}
                        {informationRequest && <InfoOutlinedIcon sx={{ fontSize: 20 }} />}
                        {changeRequest && <EditNoteOutlinedIcon sx={{ fontSize: 21 }} />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={(
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" noWrap sx={{ color: "#172033", fontWeight: unread ? 700 : 600, minWidth: 0 }}>
                            {notification.title}
                          </Typography>
                          <Typography variant="caption" sx={{ color: "#94a3b8", flexShrink: 0 }}>
                            {formatOccurredAt(notification.occurredAt)}
                          </Typography>
                        </Stack>
                      )}
                      secondary={(
                        <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.3 }}>
                          <Typography
                            variant="caption"
                            noWrap
                            sx={{ color: "#64748b", minWidth: 0, flex: 1 }}
                          >
                            {notification.message}
                          </Typography>
                          {unread && (
                            <Badge
                              badgeContent={notification.unreadCount}
                              max={99}
                              sx={{
                                mr: 0.75,
                                "& .MuiBadge-badge": {
                                  position: "static",
                                  transform: "none",
                                  bgcolor: "#fcce01",
                                  color: "#111827",
                                  fontSize: "0.62rem",
                                  fontWeight: 700,
                                },
                              }}
                            />
                          )}
                        </Stack>
                      )}
                    />
                  </ListItemButton>
                  {index < Math.min(items.length, 12) - 1 && <Divider component="li" />}
                </Box>
              );
            })}
          </List>
        )}

        {enabled && (
          <>
            <Divider />
            <Box sx={{ p: 1 }}>
              <Button
                fullWidth
                size="small"
                onClick={() => {
                  closeMenu();
                  navigate("/whatsapp");
                }}
                sx={{ color: "#334155", fontWeight: 600 }}
              >
                Ver todos los mensajes
              </Button>
            </Box>
          </>
        )}
      </Popover>
    </>
  );
};
