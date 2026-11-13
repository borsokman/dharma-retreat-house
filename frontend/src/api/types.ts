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

/** Stay dates: nights from checkIn up to, not including, checkOut. */
export interface StayDates {
  checkIn: string; // ISO yyyy-mm-dd
  checkOut: string; // ISO yyyy-mm-dd
}

/** One room type for the searched dates. */
export interface RoomAvailability {
  room: RoomType;
  /** Rooms of this type free for every night of the stay. */
  roomsLeft: number;
  nights: number;
  /** One room for the whole stay, before discount and taxes. */
  stayPrice: number;
  currency: string;
}

/** One room of a booking: its type and how many guests sleep in it. */
export interface RoomSelection {
  roomSlug: string;
  guests: number;
}

export interface StayQuoteRequest extends StayDates {
  rooms: RoomSelection[];
}

export interface StayQuote {
  nights: number;
  currency: string;
  lines: {
    roomSlug: string;
    roomName: string;
    guests: number;
    amount: number;
  }[];
  /** All rooms, all nights, before discount and taxes. */
  subtotal: number;
  /** Long-stay discount, when the nights reach a tier. */
  discount?: TaxOrFee;
  taxesAndFees: TaxOrFee[];
  totalPrice: number;
}

export interface GuestContact {
  name: string;
  email: string;
  phone: string;
}

export interface HotelBookingRequest extends StayQuoteRequest {
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
  rooms: { roomName: string; guests: number }[];
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
