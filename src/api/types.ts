/** Room and rate data shape shared across the app. */
export interface RoomType {
  slug: string;
  name: string;
  shortDescription: string;
  description: string;
  maxGuests: number;
  bedType: string;
  sizeSqm: number;
  amenities: string[];
  photos: string[];
  /** Base nightly rate in the currency below — replaced by backend pricing. */
  basePrice: number;
  currency: string;
}

export interface RoomAvailability {
  room: RoomType;
  available: boolean;
  /** Total for the whole stay, taxes and fees included where supplied. */
  totalPrice: number;
  currency: string;
  nights: number;
  taxesAndFees: { label: string; amount: number }[];
}

export interface AvailabilityQuery {
  checkIn: string; // ISO yyyy-mm-dd
  checkOut: string; // ISO yyyy-mm-dd
  guests: number;
  rooms: number;
}

export interface GuestContact {
  name: string;
  email: string;
  phone: string;
}

export interface HotelBookingRequest {
  availabilityQuery: AvailabilityQuery;
  roomSlug: string;
  contact: GuestContact;
  specialRequests?: string;
}

export interface HotelBooking {
  reference: string;
  status:
    | "pending_payment"
    | "confirmed"
    | "cancelled"
    | "checked_in"
    | "checked_out";
  roomName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPrice: number;
  currency: string;
  taxesAndFees: { label: string; amount: number }[];
  cancellationDeadline: string; // ISO
  refundPolicy: string;
  /** Hosted checkout URL returned by the backend, when payment is required. */
  paymentUrl?: string;
}

export interface RestaurantAvailabilityQuery {
  date: string; // ISO yyyy-mm-dd
  partySize: number;
}

export interface RestaurantSlot {
  time: string; // HH:mm
  available: boolean;
}

export interface RestaurantBookingRequest {
  date: string;
  time: string;
  partySize: number;
  contact: GuestContact;
  specialRequests?: string;
}

export interface RestaurantBooking {
  reference: string;
  status: "confirmed" | "cancelled";
  date: string;
  time: string;
  partySize: number;
  contact: GuestContact;
}

export interface ApiError {
  code:
    | "network"
    | "not_found"
    | "unauthorized"
    | "invalid"
    | "gone"
    | "conflict"
    | "unavailable";
  message: string;
}
