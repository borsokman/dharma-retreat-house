import type { ApiClient } from "./contract";
import type { RoomType, StayDates, StayQuote, StayQuoteRequest } from "./types";
import { rooms as staticRooms } from "../data/rooms";
import { policies } from "../data/site";
import { addDaysISO, nightsBetween } from "../utils/format";

/**
 * Mock API adapter — clearly isolated preview implementation.
 *
 * Everything this adapter returns is SIMULATED: prices, availability and
 * bookings are generated locally and are not real reservations. It follows
 * the backend's rules (backend/src/bookings.ts): one booking may hold several
 * rooms, each with its own guest count; long stays get the seeded night
 * discount. Replace it with the real HTTP client (see ./client.ts) once the
 * backend is served.
 */

const MOCK_LATENCY_MS = 600;

function delay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** Rooms per type, as seeded in backend/migrations/001_init.sql (12 in all). */
const inventory: Record<string, number> = {
  "luxury-suite": 1,
  "super-deluxe-king": 4,
  "executive-twin": 1,
  "standard-king": 2,
  "standard-twin": 4,
};

/** Same night discount tiers as the backend seed: 7+ nights 10%, 14+ 20%, 21+ 30%. */
const discountTiers = [
  { minNights: 21, percent: 30 },
  { minNights: 14, percent: 20 },
  { minNights: 7, percent: 10 },
];

/** Deterministic pseudo-occupancy so previews are stable per date. */
function seededBooked(seed: string, total: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // mostly free, sometimes partly or fully booked
  const booked = [0, 0, 0, 1, 1, 2, total][h % 7]!;
  return Math.min(booked, total);
}

function roomsLeft(room: RoomType, checkIn: string): number {
  const total = inventory[room.slug] ?? 1;
  return total - seededBooked(room.slug + checkIn, total);
}

function reference(): string {
  return `DRH-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const roundCents = (n: number) => Math.round(n * 100) / 100;

function findRoom(slug: string): RoomType {
  const room = staticRooms.find((r) => r.slug === slug);
  if (!room) throw new Error("Room not found");
  return room;
}

function checkDates({ checkIn, checkOut }: StayDates): number {
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    throw new Error("Check-out must be after check-in.");
  }
  return nightsBetween(checkIn, checkOut);
}

/** Simulated price breakdown for a set of rooms. */
function quote(req: StayQuoteRequest): StayQuote {
  const nights = checkDates(req);
  if (req.rooms.length === 0) throw new Error("Choose at least one room.");
  const lines = req.rooms.map(({ roomSlug, guests }) => {
    const room = findRoom(roomSlug);
    if (guests < 1 || guests > room.maxGuests) {
      throw new Error(`${room.name} holds up to ${room.maxGuests} guests.`);
    }
    return {
      roomSlug,
      roomName: room.name,
      guests,
      amount: room.basePrice * nights,
    };
  });
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  const tier = discountTiers.find((t) => nights >= t.minNights);
  const discount = tier
    ? {
        label: `${tier.percent}% off stays of ${tier.minNights}+ nights`,
        amount: roundCents((subtotal * tier.percent) / 100),
      }
    : undefined;
  const taxable = subtotal - (discount?.amount ?? 0);
  const taxesAndFees = [
    { label: "GST 5% (simulated)", amount: roundCents(taxable * 0.05) },
  ];
  return {
    nights,
    currency: staticRooms[0]!.currency,
    lines,
    subtotal,
    discount,
    taxesAndFees,
    totalPrice: roundCents(taxable + taxesAndFees[0]!.amount),
  };
}

export const mockApiClient: ApiClient = {
  listRooms() {
    return delay(staticRooms);
  },

  getRoom(slug) {
    return delay(staticRooms.find((r) => r.slug === slug) ?? null, 250);
  },

  async getAvailability(dates) {
    const nights = checkDates(dates);
    return delay(
      staticRooms.map((room) => ({
        room,
        roomsLeft: roomsLeft(room, dates.checkIn),
        nights,
        stayPrice: room.basePrice * nights,
        currency: room.currency,
      })),
    );
  },

  async quoteStay(req) {
    return delay(quote(req), 300);
  },

  async createHotelBooking(req) {
    const q = quote(req);
    for (const { roomSlug } of req.rooms) {
      const room = findRoom(roomSlug);
      const wanted = req.rooms.filter((r) => r.roomSlug === roomSlug).length;
      if (wanted > roomsLeft(room, req.checkIn)) {
        throw new Error(
          `Not enough ${room.name} rooms are free for these dates.`,
        );
      }
    }
    return delay({
      reference: reference(),
      status: "confirmed" as const,
      rooms: q.lines.map((l) => ({ roomName: l.roomName, guests: l.guests })),
      checkIn: req.checkIn,
      checkOut: req.checkOut,
      guests: req.rooms.reduce((sum, r) => sum + r.guests, 0),
      totalPrice: q.totalPrice,
      currency: q.currency,
      taxesAndFees: q.taxesAndFees,
      // Free cancellation ends 48 hours before check-in.
      cancellationDeadline: addDaysISO(req.checkIn, -2),
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
};
