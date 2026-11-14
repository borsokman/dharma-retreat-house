import { isMockMode, request } from "./client";

/**
 * Staff dashboard API (backend/internal/api/staff.go). The session is an
 * HttpOnly cookie set by the backend on sign-in: this code never sees it, and
 * every check happens on the server. There is no mock: the dashboard needs the
 * real backend (`npm run dev:api`).
 */

export const staffAvailable = !isMockMode;

export interface StaffUser {
  email: string;
  name: string;
  role: "admin" | "staff";
}

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "no_show"
  | "expired";

export interface Stay {
  id: number;
  roomNumber: number;
  roomType: string;
  roomSlug: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  nightlyRate: number;
  status: "active" | "cancelled";
  cancellationFee: number;
}

export interface StaffBooking {
  id: number;
  reference: string;
  status: BookingStatus;
  nextStatuses: BookingStatus[];
  source: "website" | "staff";
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests: string;
  staffNotes: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guests: number;
  stays: Stay[];
  subtotal: number;
  discount: number;
  discountLabel?: string;
  taxesAndFees: { label: string; amount: number }[];
  total: number;
  cancellationFees: number;
  amountDue: number;
  paid: number;
  balance: number;
  currency: string;
  cancellationDeadline: string;
  createdAt: string;
}

export interface HistoryEntry {
  at: string;
  staff: string;
  action: string;
  details: Record<string, unknown>;
}

export interface StayRef {
  bookingId: number;
  reference: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  status: BookingStatus;
}

export interface Room {
  number: number;
  roomType: string;
  roomSlug: string;
  maxGuests: number;
  status: "active" | "out_of_service";
  note: string;
  tonight: StayRef | null;
  next: StayRef | null;
}

export interface RoomOption {
  roomNumber: number;
  roomType: string;
  pricePerNight: number;
  maxGuests: number;
  status: "active" | "out_of_service";
  note: string;
  current: boolean;
  free: boolean;
  reason: string;
}

export interface TodayCounts {
  date: string;
  arrivals: number;
  departures: number;
  inHouse: number;
  roomsFree: number;
  outOfService: number;
  awaitingPayment: number;
}

export type BookingView =
  | "upcoming"
  | "arrivals"
  | "departures"
  | "in_house"
  | "past"
  | "cancelled"
  | "all";

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const staffApi = {
  login: (email: string, password: string) =>
    request<StaffUser>("/staff/login", json("POST", { email, password })),
  logout: () => request<void>("/staff/logout", json("POST", {})),
  me: () => request<StaffUser>("/staff/me"),
  today: () => request<TodayCounts>("/staff/today"),

  bookings: (view: BookingView, q: string) =>
    request<StaffBooking[]>(
      `/staff/bookings?${new URLSearchParams({ view, q })}`,
    ),
  booking: (id: number) =>
    request<{ booking: StaffBooking; history: HistoryEntry[] }>(
      `/staff/bookings/${id}`,
    ),
  setStatus: (id: number, status: BookingStatus) =>
    request<StaffBooking>(`/staff/bookings/${id}`, json("PATCH", { status })),
  setNotes: (id: number, staffNotes: string) =>
    request<StaffBooking>(
      `/staff/bookings/${id}`,
      json("PATCH", { staffNotes }),
    ),
  moveOptions: (id: number, stayId: number) =>
    request<RoomOption[]>(`/staff/bookings/${id}/stays/${stayId}/options`),
  moveStay: (
    id: number,
    stayId: number,
    roomNumber: number,
    reprice: boolean,
  ) =>
    request<StaffBooking>(
      `/staff/bookings/${id}/stays/${stayId}/move`,
      json("POST", { roomNumber, reprice }),
    ),

  rooms: () => request<Room[]>("/staff/rooms"),
  setRoomStatus: (number: number, status: Room["status"], note: string) =>
    request<Room>(`/staff/rooms/${number}`, json("PATCH", { status, note })),
};

/** Labels staff see for each status, and the button that moves a booking there. */
export const statusLabel: Record<BookingStatus, string> = {
  pending_payment: "Awaiting payment",
  confirmed: "Confirmed",
  checked_in: "Checked in",
  checked_out: "Checked out",
  cancelled: "Cancelled",
  no_show: "No-show",
  expired: "Expired",
};
