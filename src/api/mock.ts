import type { ApiClient } from "./contract";
import type { AvailabilityQuery, RoomType } from "./types";
import { rooms as staticRooms } from "../data/rooms";
import { buffetTimes, policies } from "../data/site";
import { addDaysISO, nightsBetween } from "../utils/format";

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

const roundCents = (n: number) => Math.round(n * 100) / 100;

/** Simulated price breakdown for a stay. */
function quote(room: RoomType, query: AvailabilityQuery) {
  const nights = Math.max(1, nightsBetween(query.checkIn, query.checkOut));
  const roomTotal = room.basePrice * nights * query.rooms;
  const taxesAndFees = [
    { label: "City tax", amount: roundCents(roomTotal * 0.03) },
    { label: "Service charge", amount: roundCents(roomTotal * 0.05) },
  ];
  const taxTotal = taxesAndFees.reduce((sum, t) => sum + t.amount, 0);
  return {
    nights,
    taxesAndFees,
    currency: room.currency,
    totalPrice: roundCents(roomTotal + taxTotal),
  };
}

export const mockApiClient: ApiClient = {
  listRooms() {
    return delay(staticRooms);
  },

  getRoom(slug) {
    return delay(staticRooms.find((r) => r.slug === slug) ?? null, 250);
  },

  getAvailability(query) {
    return delay(
      staticRooms
        .filter((r) => r.maxGuests * query.rooms >= query.guests)
        .map((room) => ({
          room,
          available: seededAvailable(room.slug + query.checkIn),
          ...quote(room, query),
        })),
    );
  },

  async createHotelBooking(req) {
    const room = staticRooms.find((r) => r.slug === req.roomSlug);
    if (!room) throw new Error("Room not found");
    const { checkIn, checkOut, guests } = req.availabilityQuery;
    const { totalPrice, currency, taxesAndFees } = quote(
      room,
      req.availabilityQuery,
    );
    return delay({
      reference: reference("DRH"),
      status: "confirmed" as const,
      roomName: room.name,
      checkIn,
      checkOut,
      guests,
      totalPrice,
      currency,
      taxesAndFees,
      // Free cancellation ends 48 hours before check-in.
      cancellationDeadline: addDaysISO(checkIn, -2),
      refundPolicy: policies.cancellation,
      // The real backend returns a payment provider URL when payment is required.
      paymentUrl: undefined,
    });
  },

  async getHotelBooking() {
    throw new Error(
      "Lookup is not available in preview mode: the real backend verifies booking references and secure tokens.",
    );
  },

  async cancelHotelBooking() {
    throw new Error(
      "Cancellation is not available in preview mode: the real backend verifies secure cancellation tokens.",
    );
  },

  getBuffetSlots(query) {
    return delay(
      buffetTimes.map((time) => ({
        time,
        available: seededAvailable(time + query.date + query.partySize),
      })),
    );
  },

  createBuffetBooking(req) {
    return delay({
      reference: reference("RST"),
      status: "confirmed" as const,
      date: req.date,
      time: req.time,
      partySize: req.partySize,
      contact: req.contact,
    });
  },
};
