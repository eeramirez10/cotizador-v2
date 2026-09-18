import CloseIcon from "@mui/icons-material/Close";
import WhatsAppIcon from "@mui/icons-material/WhatsApp";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import { Alert, Avatar, Box, Button, ButtonBase, CircularProgress, IconButton, Paper, Snackbar, Stack, Typography } from "@mui/material";
import { useSyncExternalStore } from "react";
import {
  dismissMuiNotification,
  getMuiNotificationsSnapshot,
  subscribeMuiNotifications,
} from "./mui-notification.store";

export const NotificationCenter = () => {
  const notifications = useSyncExternalStore(
    subscribeMuiNotifications,
    getMuiNotificationsSnapshot,
    getMuiNotificationsSnapshot,
  );
  const active = notifications[0];

  const close = (_event?: unknown, reason?: string): void => {
    if (!active || reason === "clickaway") return;
    dismissMuiNotification(active.id);
  };

  const whatsappMessage = active?.presentation?.variant === "whatsapp-message";
  const quoteDecision = active?.presentation?.variant === "quote-decision";
  const richNotification = whatsappMessage || quoteDecision;
  const tone = active?.presentation?.tone || active?.level || "info";
  const accentColor = quoteDecision
    ? tone === "success" ? "#20a85b" : tone === "warning" ? "#d49b0b" : "#d84a4a"
    : "#20c96b";

  return (
    <Snackbar
      key={active ? `${active.id}-${active.revision}` : "empty"}
      open={Boolean(active)}
      autoHideDuration={active?.durationMs ?? null}
      onClose={close}
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
    >
      {active && richNotification ? (
        <Paper
          role="alert"
          elevation={0}
          sx={{
            position: "relative",
            display: "flex",
            width: { xs: "calc(100vw - 24px)", sm: 410 },
            minHeight: 82,
            overflow: "hidden",
            borderRadius: "20px",
            bgcolor: "#ffffff",
            boxShadow: "0 18px 46px rgba(15, 23, 42, 0.18)",
          }}
        >
          <Box sx={{ width: 4, flexShrink: 0, bgcolor: accentColor }} />
          <ButtonBase
            onClick={() => {
              active.action?.onClick();
              dismissMuiNotification(active.id);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              justifyContent: "flex-start",
              gap: 1.5,
              px: 1.75,
              py: 1.4,
              textAlign: "left",
            }}
          >
            <Avatar
              sx={{
                width: 46,
                height: 46,
                flexShrink: 0,
                bgcolor: accentColor,
                color: "#ffffff",
                boxShadow: `0 8px 18px ${accentColor}40`,
              }}
            >
              {whatsappMessage && <WhatsAppIcon sx={{ fontSize: 25 }} />}
              {quoteDecision && tone === "success" && <CheckCircleOutlineIcon sx={{ fontSize: 25 }} />}
              {quoteDecision && tone === "warning" && <ReportProblemOutlinedIcon sx={{ fontSize: 25 }} />}
              {quoteDecision && tone === "error" && <CancelOutlinedIcon sx={{ fontSize: 25 }} />}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1, pr: 10 }}>
              <Typography
                variant="body2"
                noWrap
                sx={{ color: "#334155", fontWeight: 700, lineHeight: 1.35 }}
              >
                {active.presentation?.title}
              </Typography>
              <Typography
                variant="caption"
                noWrap
                sx={{ display: "block", mt: 0.45, color: "#64748b", fontSize: "0.78rem" }}
              >
                {active.message}
              </Typography>
            </Box>
          </ButtonBase>
          <Typography
            variant="caption"
            sx={{ position: "absolute", top: 17, right: 50, color: "#94a3b8", fontSize: "0.68rem" }}
          >
            Ahora
          </Typography>
          <IconButton
            aria-label="Cerrar notificación"
            size="small"
            onClick={() => dismissMuiNotification(active.id)}
            sx={{
              position: "absolute",
              top: 11,
              right: 11,
              color: "#94a3b8",
              "&:hover": { bgcolor: "#f1f5f9", color: "#475569" },
            }}
          >
            <CloseIcon sx={{ fontSize: 19 }} />
          </IconButton>
        </Paper>
      ) : active ? (
        <Alert
          severity={active.level}
          variant="filled"
          icon={active.loading ? <CircularProgress size={18} color="inherit" /> : undefined}
          action={(
            <Stack direction="row" alignItems="center" spacing={0.5}>
              {active.action && (
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    active.action?.onClick();
                    dismissMuiNotification(active.id);
                  }}
                  sx={{ minWidth: 0, fontWeight: 700 }}
                >
                  {active.action.label}
                </Button>
              )}
              <IconButton
                aria-label="Cerrar notificación"
                color="inherit"
                size="small"
                onClick={() => dismissMuiNotification(active.id)}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>
          )}
          sx={{
            width: "100%",
            minWidth: { sm: 340 },
            maxWidth: 480,
            alignItems: "center",
            boxShadow: "0 16px 36px rgba(15, 23, 42, 0.18)",
          }}
        >
          {active.message}
        </Alert>
      ) : undefined}
    </Snackbar>
  );
};
