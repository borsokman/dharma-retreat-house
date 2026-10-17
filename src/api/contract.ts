import type {
  AvailabilityQuery,
  HotelBooking,
  HotelBookingRequest,
  RestaurantAvailabilityQuery,
  RestaurantBooking,
  RestaurantBookingRequest,
  RestaurantSlot,
  RoomAvailability,
  RoomType,
} from "./types";

/**
 * The contract the Go backend must fulfill. The mock adapter implements the
 * same interface, so switching to the real API means swapping the
 * implementation in ./client.ts only — no component changes.
 */
export interface ApiClient {
  listRooms(): Promise<RoomType[]>;
  getRoom(slug: string): Promise<RoomType | null>;
  getAvailability(query: AvailabilityQuery): Promise<RoomAvailability[]>;
  createHotelBooking(req: HotelBookingRequest): Promise<HotelBooking>;
  getHotelBooking(reference: string, token: string): Promise<HotelBooking>;
  cancelHotelBooking(reference: string, token: string): Promise<HotelBooking>;
  getRestaurantSlots(
    query: RestaurantAvailabilityQuery,
  ): Promise<RestaurantSlot[]>;
  createRestaurantBooking(
    req: RestaurantBookingRequest,
  ): Promise<RestaurantBooking>;
}
