import type { BookingStatus } from "../../api/staff";

const shortDateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

/** "2030-02-01" → "Fri 1 Feb" (the date is read as a calendar day, not a moment) */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return shortDateFormat.format(new Date(y!, m! - 1, d!));
}

const momentFormat = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** UTC timestamp → local "1 Feb, 14:05" */
export function shortMoment(isoUtc: string): string {
  return momentFormat.format(new Date(isoUtc));
}

export const statusBadge: Record<BookingStatus, string> = {
  pending_payment: "badge--clay",
  confirmed: "badge--sage",
  checked_in: "badge--water",
  checked_out: "badge--muted",
  cancelled: "badge--sunset",
  no_show: "badge--sunset",
  expired: "badge--muted",
};

/** The button that moves a booking from `from` to `to`. */
export function actionLabel(from: BookingStatus, to: BookingStatus): string {
  if (to === "confirmed") {
    if (from === "pending_payment") return "Confirm (paid)";
    if (from === "checked_in") return "Undo check-in";
    return "Reinstate";
  }
  if (to === "checked_in")
    return from === "checked_out" ? "Undo check-out" : "Check in";
  if (to === "checked_out") return "Check out";
  if (to === "no_show") return "Mark no-show";
  if (to === "cancelled") return "Cancel booking";
  if (to === "pending_payment") return "Back to awaiting payment";
  return to;
}
