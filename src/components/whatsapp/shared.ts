import type { Page } from "@/api/whatsapp";
import { BTN, BTN_SECONDARY, CARD, INPUT } from "@/components/comms/CommsKit";

// WhatsApp tabs share the Communications kit so they match Home and AI Calling.
export const card = CARD;
export const input = INPUT;
export const button = BTN;
export const secondary = BTN_SECONDARY;
export const consent =
  "I confirm these recipients opted in to receive WhatsApp messages from this college.";
export const emptyPage = <T>(): Page<T> => ({ items: [], total: 0 });
export function errorText(error: unknown) {
  const detail = (error as { response?: { data?: { detail?: unknown } } })
    ?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((d: { msg?: string }) => d.msg).join(". ");
  if (detail && typeof detail === "object" && "message" in detail)
    return String(detail.message);
  return "Unable to complete this action. Please try again.";
}

/** Human file size for attachment tiles and upload previews. */
export function readableSize(bytes: number) {
  if (!bytes) return "";
  const units = ["B", "KB", "MB"];
  let value = bytes,
    unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/** Plain-language labels for the states a message or template moves through.
 *  Internal names like "accepted" or "queued" describe our plumbing, not what
 *  happened to the customer's message, so they never reach the screen. */
const MESSAGE_STATUS: Record<string, string> = {
  queued: "Sending",
  sending: "Sending",
  accepted: "Sent",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  received: "Received",
  failed: "Not delivered",
  blocked: "Not sent",
  cancelled: "Cancelled",
  unknown: "Awaiting confirmation",
};
const TEMPLATE_STATUS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTING: "Submitting",
  PENDING: "In review",
  APPROVED: "Approved",
  REJECTED: "Not approved",
  PAUSED: "Paused",
  DISABLED: "Disabled",
  UNKNOWN: "Awaiting confirmation",
};
const CAMPAIGN_STATUS: Record<string, string> = {
  draft: "Draft",
  scheduled: "Scheduled",
  running: "Sending",
  completed: "Completed",
  completed_with_errors: "Completed with errors",
  cancelled: "Cancelled",
};
export function statusLabel(value: string) {
  return (
    MESSAGE_STATUS[value] ??
    TEMPLATE_STATUS[value] ??
    CAMPAIGN_STATUS[value] ??
    value.replaceAll("_", " ")
  );
}
