/**
 * The message the API sent back with a failed request, if it sent one.
 *
 * FastAPI returns `detail` in three shapes: a string (HTTPException), an object
 * such as `{ message, reasons }`, or an array of validation errors (422). Pages
 * that only handled the string shape fell back to a generic "check the fields"
 * message and hid the real reason, so this reads all three.
 */
export function apiErrorDetail(error: unknown): string | undefined {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  if (typeof detail === "string") return detail || undefined;
  if (Array.isArray(detail)) {
    const text = detail
      .map((item: { msg?: string }) => String(item?.msg || "").replace(/^Value error, /, ""))
      .filter(Boolean)
      .join(". ");
    return text || undefined;
  }
  if (detail && typeof detail === "object") {
    const { reasons, message } = detail as { reasons?: unknown; message?: unknown };
    if (Array.isArray(reasons) && reasons.length) return reasons.map(String).join(" · ");
    if (message) return String(message);
  }
  return undefined;
}
