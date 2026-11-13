import Database from "better-sqlite3";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db.js";
import { ValidationError } from "./admin.js";

/** The rooms asked for are no longer free (HTTP 409 later). */
export class UnavailableError extends Error {}

// ---- input shapes ----------------------------------------------------------

export interface StayDates {
  checkIn: string; // 'YYYY-MM-DD', hotel-local
  checkOut: string;
}

/** One room of a booking: which room type, and how many guests sleep in it. */
export interface RoomRequest {
  roomTypeSlug: string;
  guests: number;
}

export interface GuestContact {
  name: string;
  email: string;
  phone: string;
}

export interface BookingRequest extends StayDates {
  rooms: RoomRequest[];
  contact: GuestContact;
  specialRequests?: string;
}

// ---- dates -----------------------------------------------------------------

const DAY_MS = 86_400_000;
const IST_OFFSET = "+05:30"; // India has no DST (see the room guards in 001_init.sql)
const HOLD_MINUTES = 30; // an unpaid booking holds its rooms this long

const isIsoDate = (s: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().startsWith(s);

/** Hotel-local calendar date of a moment. */
export function hotelToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

const utcIso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");

/** Validates the stay and returns its number of nights. */
export function nightsOf({ checkIn, checkOut }: StayDates, now: Date = new Date()): number {
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) {
    throw new ValidationError("dates must be valid YYYY-MM-DD dates");
  }
  if (checkOut <= checkIn) throw new ValidationError("check-out must be after check-in");
  if (checkIn < hotelToday(now)) throw new ValidationError("check-in cannot be in the past");
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / DAY_MS);
}

/**
 * How many rooms a party may book: every room needs at least one guest
 * (booking_rooms.guests >= 1) and may not hold more than maxPerRoom.
 * E.g. 3 guests with 2 per room -> 2 or 3 rooms.
 */
export function roomCountRange(guests: number, maxPerRoom: number): { min: number; max: number } {
  return { min: Math.ceil(guests / maxPerRoom), max: guests };
}

// ---- availability ----------------------------------------------------------

export interface TypeAvailability {
  slug: string;
  name: string;
  pricePerNightPaise: number;
  /** Largest party one room of this type can take. */
  maxGuests: number;
  /** Rooms of this type free for EVERY night of the stay. */
  freeRooms: number;
}

const FREE_ROOM = `
  r.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM v_holding_stays br
    WHERE br.room_id = r.id
      AND br.check_in_date  < @checkOut
      AND br.check_out_date > @checkIn)`;

/** Free rooms per room type for [checkIn, checkOut), most expensive type first. */
export function searchAvailability(db: Db, dates: StayDates, now: Date = new Date()): TypeAvailability[] {
  nightsOf(dates, now);
  return db
    .prepare(
      `SELECT t.slug, t.name, t.price_per_night_paise AS pricePerNightPaise,
              (SELECT COALESCE(MAX(max_guests), 0) FROM rooms
                WHERE room_type_id = t.id AND status = 'active') AS maxGuests,
              (SELECT COUNT(*) FROM rooms r
                WHERE r.room_type_id = t.id AND ${FREE_ROOM}) AS freeRooms
       FROM room_types t
       ORDER BY t.price_per_night_paise DESC, t.name`,
    )
    .all({ checkIn: dates.checkIn, checkOut: dates.checkOut }) as TypeAvailability[];
}

// ---- prices ----------------------------------------------------------------

export interface QuoteLine {
  roomTypeSlug: string;
  roomTypeName: string;
  guests: number;
  nightlyRatePaise: number;
  /** nights * nightly rate, before discount and tax */
  amountPaise: number;
  discountPaise: number;
  taxPaise: number;
  taxLabel: string | null;
  taxRateBp: number;
}

export interface Quote {
  nights: number;
  lines: QuoteLine[];
  subtotalPaise: number;
  discountBp: number;
  discountPaise: number;
  /** one line per tax slab used */
  taxBreakdown: { label: string; rateBp: number; amountPaise: number }[];
  taxPaise: number;
  totalPaise: number;
}

const bp = (paise: number, basisPoints: number) => Math.round((paise * basisPoints) / 10_000);

/**
 * Prices a stay of one or more rooms with the CURRENT rates, discount tiers and
 * tax slabs. The discount tier follows the number of nights and applies to every
 * room; tax is looked up per room on its discounted nightly value. Every line is
 * rounded on its own, so the totals always satisfy
 * total = subtotal - discount + tax (the CHECK on bookings).
 */
export function quoteStay(db: Db, dates: StayDates, rooms: RoomRequest[], now: Date = new Date()): Quote {
  const nights = nightsOf(dates, now);
  if (rooms.length === 0) throw new ValidationError("choose at least one room");

  const discountBp =
    (
      db
        .prepare("SELECT discount_bp AS bp FROM discount_tiers WHERE min_nights <= ? ORDER BY min_nights DESC LIMIT 1")
        .get(nights) as { bp: number } | undefined
    )?.bp ?? 0;
  const typeStmt = db.prepare(
    "SELECT name, price_per_night_paise AS rate FROM room_types WHERE slug = ?",
  );
  const slabStmt = db.prepare(
    "SELECT label, rate_bp AS rateBp FROM tax_slabs WHERE from_nightly_paise <= ? ORDER BY from_nightly_paise DESC LIMIT 1",
  );

  const lines = rooms.map((req): QuoteLine => {
    if (!Number.isInteger(req.guests) || req.guests < 1) {
      throw new ValidationError("every room needs at least one guest");
    }
    const type = typeStmt.get(req.roomTypeSlug) as { name: string; rate: number } | undefined;
    if (!type) throw new ValidationError(`unknown room type: ${req.roomTypeSlug}`);
    const amountPaise = type.rate * nights;
    const discountPaise = bp(amountPaise, discountBp);
    const slab = slabStmt.get(type.rate - bp(type.rate, discountBp)) as
      | { label: string; rateBp: number }
      | undefined;
    return {
      roomTypeSlug: req.roomTypeSlug,
      roomTypeName: type.name,
      guests: req.guests,
      nightlyRatePaise: type.rate,
      amountPaise,
      discountPaise,
      taxPaise: slab ? bp(amountPaise - discountPaise, slab.rateBp) : 0,
      taxLabel: slab?.label ?? null,
      taxRateBp: slab?.rateBp ?? 0,
    };
  });

  const taxBreakdown: Quote["taxBreakdown"] = [];
  for (const l of lines) {
    if (!l.taxLabel) continue;
    const row = taxBreakdown.find((t) => t.label === l.taxLabel);
    if (row) row.amountPaise += l.taxPaise;
    else taxBreakdown.push({ label: l.taxLabel, rateBp: l.taxRateBp, amountPaise: l.taxPaise });
  }
  const sum = (f: (l: QuoteLine) => number) => lines.reduce((s, l) => s + f(l), 0);
  const subtotalPaise = sum((l) => l.amountPaise);
  const discountPaise = sum((l) => l.discountPaise);
  const taxPaise = sum((l) => l.taxPaise);
  return {
    nights,
    lines,
    subtotalPaise,
    discountBp,
    discountPaise,
    taxBreakdown,
    taxPaise,
    totalPaise: subtotalPaise - discountPaise + taxPaise,
  };
}

// ---- creating a booking ----------------------------------------------------

export interface CreatedBooking {
  bookingId: number;
  reference: string;
  /** Goes into the guest's manage link. Only its hash is stored. */
  manageToken: string;
  holdExpiresAt: string;
  cancellationDeadline: string;
  rooms: { roomNumber: number; roomTypeSlug: string; guests: number }[];
  quote: Quote;
}

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I
function newReference(): string {
  const bytes = randomBytes(6);
  return "DRH-" + Array.from(bytes, (b) => REF_ALPHABET[b % REF_ALPHABET.length]).join("");
}

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Books one or more rooms for one party in a single transaction. For every
 * requested room it picks the lowest-numbered free room of that type that holds
 * the requested guests, never the same room twice. The booking starts as
 * 'pending_payment' and holds its rooms until holdExpiresAt.
 *
 * Two guests racing for the last room: the transaction re-checks inside the
 * write lock, and the overlap trigger is the final guard; the loser gets an
 * UnavailableError.
 */
export function createBooking(db: Db, req: BookingRequest, now: Date = new Date()): CreatedBooking {
  const contact = {
    name: req.contact.name?.trim() ?? "",
    email: req.contact.email?.trim() ?? "",
    phone: req.contact.phone?.trim() ?? "",
  };
  if (!contact.name || !contact.phone || !/^\S+@\S+\.\S+$/.test(contact.email)) {
    throw new ValidationError("name, a valid email and a phone number are required");
  }
  const manageToken = randomBytes(24).toString("base64url");
  const holdExpiresAt = utcIso(now.getTime() + HOLD_MINUTES * 60_000);

  const run = db.transaction((): CreatedBooking => {
    const quote = quoteStay(db, req, req.rooms, now);
    const settings = db
      .prepare("SELECT check_in_time AS t, cancellation_window_hours AS h FROM settings WHERE id = 1")
      .get() as { t: string; h: number };
    const cancellationDeadline = utcIso(
      Date.parse(`${req.checkIn}T${settings.t}:00${IST_OFFSET}`) - settings.h * 3_600_000,
    );

    // Assign real rooms: biggest parties first, so a 2-guest room is not used up by a single guest.
    const pickStmt = db.prepare(
      `SELECT r.id, r.room_number AS roomNumber FROM rooms r
       JOIN room_types t ON t.id = r.room_type_id
       WHERE t.slug = @slug AND r.max_guests >= @guests AND ${FREE_ROOM}
         AND r.id NOT IN (SELECT value FROM json_each(@taken))
       ORDER BY r.max_guests, r.room_number LIMIT 1`,
    );
    const order = quote.lines.map((_, i) => i).sort((a, b) => quote.lines[b]!.guests - quote.lines[a]!.guests);
    const picked: { id: number; roomNumber: number }[] = [];
    for (const i of order) {
      const line = quote.lines[i]!;
      const room = pickStmt.get({
        slug: line.roomTypeSlug,
        guests: line.guests,
        checkIn: req.checkIn,
        checkOut: req.checkOut,
        taken: JSON.stringify(picked.filter(Boolean).map((p) => p.id)),
      }) as { id: number; roomNumber: number } | undefined;
      if (!room) {
        throw new UnavailableError(`not enough ${line.roomTypeName} rooms are free for these dates`);
      }
      picked[i] = room;
    }

    const bookingCols = {
      manage_token_hash: hashToken(manageToken),
      guest_name: contact.name,
      guest_email: contact.email,
      guest_phone: contact.phone,
      special_requests: req.specialRequests?.trim() || null,
      subtotal_paise: quote.subtotalPaise,
      discount_bp: quote.discountBp,
      discount_paise: quote.discountPaise,
      tax_paise: quote.taxPaise,
      tax_breakdown: JSON.stringify(quote.taxBreakdown),
      total_paise: quote.totalPaise,
      hold_expires_at: holdExpiresAt,
    };
    const insertBooking = db.prepare(
      `INSERT INTO bookings (reference, ${Object.keys(bookingCols).join(", ")})
       VALUES (@reference, ${Object.keys(bookingCols).map((k) => "@" + k).join(", ")})`,
    );
    let reference = "";
    let bookingId = 0;
    for (let attempt = 0; !bookingId; attempt++) {
      reference = newReference();
      try {
        bookingId = Number(insertBooking.run({ reference, ...bookingCols }).lastInsertRowid);
      } catch (e) {
        const clash = e instanceof Database.SqliteError && e.code === "SQLITE_CONSTRAINT_UNIQUE";
        if (!clash || attempt >= 4) throw e;
      }
    }

    const insertStay = db.prepare(
      `INSERT INTO booking_rooms (booking_id, room_id, check_in_date, check_out_date, guests,
                                  nightly_rate_paise, cancellation_deadline)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    quote.lines.forEach((line, i) => {
      insertStay.run(bookingId, picked[i]!.id, req.checkIn, req.checkOut, line.guests,
        line.nightlyRatePaise, cancellationDeadline);
    });

    return {
      bookingId,
      reference,
      manageToken,
      holdExpiresAt,
      cancellationDeadline,
      rooms: quote.lines.map((l, i) => ({
        roomNumber: picked[i]!.roomNumber,
        roomTypeSlug: l.roomTypeSlug,
        guests: l.guests,
      })),
      quote,
    };
  });

  try {
    // IMMEDIATE: take the write lock before reading availability.
    return run.immediate();
  } catch (e) {
    if (e instanceof Database.SqliteError) {
      if (/room already booked|out of service/.test(e.message)) {
        throw new UnavailableError("a room was just taken: please search again");
      }
      if (/more guests than the room allows/.test(e.message)) {
        throw new ValidationError("more guests than the room allows");
      }
    }
    throw e;
  }
}
