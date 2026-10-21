import type { ApiClient } from "./contract";
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
import { rooms as staticRooms } from "../data/rooms";
import { policies } from "../data/site";

/**
 * Mock API adapter — clearly isolated preview implementation.
 *
 * Everything this adapter returns is SIMULATED: prices, availability and
 * bookings are generated locally and are not real reservations. Replace
 * this adapter with the real HTTP client (see ./client.ts) once the Go
 * backend is available.
 */

const MOCK_LATENCY_MS = 600;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

function todayPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + "T00:00:00").getTime();
  const b = new Date(checkOut + "T00:00:00").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

/** Deterministic pseudo-availability so previews are stable per date. */
function seededAvailable(seed: string): boolean {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return h % 10 > 1; // ~80% available
}

function reference(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${rand}`;
}

function makeTaxesAndFees(base: number, nights: number) {
  const roomTotal = base * nights;
  return [
    { label: "City tax", amount: Math.round(roomTotal * 0.03 * 100) / 100 },
    { label: "Service charge", amount: Math.round(roomTotal * 0.05 * 100) / 100 },
  ];
}

export const mockApiClient: ApiClient = {
  listRooms(): Promise<RoomType[]> {
    return delay(staticRooms);
  },

  async getRoom(slug: string): Promise<RoomType | null> {
    return delay(staticRooms.find((r) => r.slug === slug) ?? null, 250);
  },

  async getAvailability(query: AvailabilityQuery): Promise<RoomAvailability[]> {
    const nights = nightsBetween(query.checkIn, query.checkOut);
    return delay(
      staticRooms
        .filter((r) => r.maxGuests * query.rooms >= query.guests)
        .map((room) => {
          const available = seededAvailable(room.slug + query.checkIn);
          const roomTotal = room.basePrice * nights * query.rooms;
          const taxesAndFees = makeTaxesAndFees(
            room.basePrice * query.rooms,
            nights,
          );
          const taxTotal = taxesAndFees.reduce((s, t) => s + t.amount, 0);
          return {
            room,
            available,
            nights,
            currency: room.currency,
            taxesAndFees,
            totalPrice: Math.round((roomTotal + taxTotal) * 100) / 100,
          };
        }),
    );
  },

  async createHotelBooking(req: HotelBookingRequest): Promise<HotelBooking> {
    const room = staticRooms.find((r) => r.slug === req.roomSlug);
    if (!room) throw new Error("Room not found");
    const nights = nightsBetween(
      req.availabilityQuery.checkIn,
      req.availabilityQuery.checkOut,
    );
    const roomTotal = room.basePrice * nights * req.availabilityQuery.rooms;
    const taxesAndFees = makeTaxesAndFees(
      room.basePrice * req.availabilityQuery.rooms,
      nights,
    );
    const taxTotal = taxesAndFees.reduce((s, t) => s + t.amount, 0);
    const deadline = new Date();
    deadline.setHours(deadline.getHours() - 48);
    return delay({
      reference: reference("DRH"),
      status: "confirmed",
      roomName: room.name,
      checkIn: req.availabilityQuery.checkIn,
      checkOut: req.availabilityQuery.checkOut,
      guests: req.availabilityQuery.guests,
      totalPrice: Math.round((roomTotal + taxTotal) * 100) / 100,
      currency: room.currency,
      taxesAndFees,
      cancellationDeadline: todayPlus(2),
      refundPolicy: policies.cancellation,
      // Simulated hosted-checkout placeholder. The real backend returns a
      // payment provider URL when payment is required.
      paymentUrl: undefined,
    });
  },

  getHotelBooking(_reference: string, _token: string): Promise<HotelBooking> {
    throw new Error(
      "Lookup is not available in preview mode: the real backend verifies booking references and secure tokens.",
    );
  },

  cancelHotelBooking(
    _reference: string,
    _token: string,
  ): Promise<HotelBooking> {
    throw new Error(
      "Cancellation is not available in preview mode: the real backend verifies secure cancellation tokens.",
    );
  },

  getRestaurantSlots(
    query: RestaurantAvailabilityQuery,
  ): Promise<RestaurantSlot[]> {
    const times = ["12:00", "12:30", "13:00", "13:30", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30"];
    return delay(
      times.map((time) => ({
        time,
        available: seededAvailable(time + query.date + query.partySize),
      })),
    );
  },

  async createRestaurantBooking(
    req: RestaurantBookingRequest,
  ): Promise<RestaurantBooking> {
    return delay({
      reference: reference("RST"),
      status: "confirmed",
      date: req.date,
      time: req.time,
      partySize: req.partySize,
      contact: req.contact,
    });
  },
};
