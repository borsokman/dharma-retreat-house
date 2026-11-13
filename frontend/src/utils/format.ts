const DAY_MS = 86_400_000;

function parseISODate(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

/** Formats a Date as yyyy-mm-dd in the visitor's local time zone. */
function toISODate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDateLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Local calendar date (not UTC), optionally shifted by whole days. */
export function todayISO(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toISODate(d);
}

/** Shifts an ISO yyyy-mm-dd date by whole days. */
export function addDaysISO(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = parseISODate(checkOut).getTime() - parseISODate(checkIn).getTime();
  return Math.max(0, Math.round(ms / DAY_MS));
}

const moneyFormatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(amount: number, currency: string): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  const key = `${currency}:${digits}`;
  let formatter = moneyFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    });
    moneyFormatters.set(key, formatter);
  }
  return formatter.format(amount);
}

/** "1 guest", "3 guests", "2 nights" … */
export function pluralize(n: number, singular: string, plural = `${singular}s`) {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** [1, 2, …, n] — for numeric select options. */
export function range(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i + 1);
}

/** "pending_payment" → "pending payment" */
export function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function isValidEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email.trim());
}
