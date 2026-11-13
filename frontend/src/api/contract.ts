import type {
  StayDates,
  StayQuote,
  StayQuoteRequest,
  HotelBooking,
  HotelBookingRequest,
  RoomAvailability,
  RoomType,
} from "./types";

/**
 * The contract the booking backend must fulfill. The mock adapter implements the
 * same interface, so switching to the real API means swapping the
 * implementation in ./client.ts only — no component changes.
 */
export interface ApiClient {
  listRooms(): Promise<RoomType[]>;
  getRoom(slug: string): Promise<RoomType | null>;
  /** Free rooms per room type for the dates. */
  getAvailability(dates: StayDates): Promise<RoomAvailability[]>;
  /** Price of a set of rooms (backend applies discounts and taxes). */
  quoteStay(req: StayQuoteRequest): Promise<StayQuote>;
  /** One booking for one party, holding one or more rooms. */
  createHotelBooking(req: HotelBookingRequest): Promise<HotelBooking>;
  getHotelBooking(reference: string, token: string): Promise<HotelBooking>;
  cancelHotelBooking(reference: string, token: string): Promise<HotelBooking>;
}
