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

export interface TaxOrFee {
  label: string;
  amount: number;
}

export interface RoomAvailability {
  room: RoomType;
  available: boolean;
  /** Total for the whole stay, taxes and fees included where supplied. */
  totalPrice: number;
  currency: string;
  nights: number;
  taxesAndFees: TaxOrFee[];
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
  taxesAndFees: TaxOrFee[];
  cancellationDeadline: string; // ISO
  refundPolicy: string;
  /** Hosted checkout URL returned by the backend, when payment is required. */
  paymentUrl?: string;
}

export interface BuffetAvailabilityQuery {
  date: string; // ISO yyyy-mm-dd
  partySize: number;
}

export interface BuffetSlot {
  time: string; // HH:mm
  available: boolean;
}

export interface BuffetBookingRequest {
  date: string;
  time: string;
  partySize: number;
  contact: GuestContact;
  specialRequests?: string;
}

export interface BuffetBooking {
  reference: string;
  status: "confirmed" | "cancelled";
  date: string;
  time: string;
  partySize: number;
  contact: GuestContact;
}
