import { ChatMessageInlineMeta } from "@mui/x-chat";
import type { ChatMessageInlineMetaProps } from "@mui/x-chat";
import { useMessageContext } from "@mui/x-chat-headless";
import { Typography } from "@mui/material";

interface QuoteDeliveryMetadata {
  quoteDeliveryStatus?: "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
  quoteDeliveryError?: string | null;
}

export const WhatsAppQuoteMessageMeta = (props: ChatMessageInlineMetaProps) => {
  const { message } = useMessageContext();
  const delivery = message?.metadata as QuoteDeliveryMetadata | undefined;
  if (!delivery?.quoteDeliveryStatus) return <ChatMessageInlineMeta {...props} />;

  const label = delivery.quoteDeliveryStatus === "FAILED"
    ? "No entregada"
    : delivery.quoteDeliveryStatus === "READ"
      ? "Leída"
      : delivery.quoteDeliveryStatus === "DELIVERED"
        ? "Entregada"
        : "Pendiente de entrega";

  return (
    <>
      <Typography component="div" variant="caption" sx={{ color: delivery.quoteDeliveryStatus === "FAILED" ? "#b91c1c" : "#475569", fontSize: "0.68rem", mt: 0.5 }}>
        {label}{delivery.quoteDeliveryStatus === "FAILED" && delivery.quoteDeliveryError ? `: ${delivery.quoteDeliveryError}` : ""}
      </Typography>
      <ChatMessageInlineMeta {...props} />
    </>
  );
};
