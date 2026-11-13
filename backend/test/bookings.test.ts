import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, type Db } from "../src/db.js";
import { ValidationError } from "../src/admin.js";
import {
  createBooking, quoteStay, roomCountRange, searchAvailability, UnavailableError,
  type BookingRequest,
} from "../src/bookings.js";

const NOW = new Date("2030-01-01T06:00:00Z");
const contact = { name: "Tenzin", email: "tenzin@example.in", phone: "+91 90000 00000" };
const free = (db: Db, slug: string, checkIn = "2030-02-01", checkOut = "2030-02-03") =>
  searchAvailability(db, { checkIn, checkOut }, NOW).find((t) => t.slug === slug)!.freeRooms;
const book = (db: Db, rooms: BookingRequest["rooms"], checkIn = "2030-02-01", checkOut = "2030-02-03") =>
  createBooking(db, { checkIn, checkOut, rooms, contact }, NOW);

test("rooms a party may book: at least one guest per room, at most two", () => {
  assert.deepEqual(roomCountRange(1, 2), { min: 1, max: 1 });
  assert.deepEqual(roomCountRange(2, 2), { min: 1, max: 2 });
  assert.deepEqual(roomCountRange(3, 2), { min: 2, max: 3 });
  assert.deepEqual(roomCountRange(24, 2), { min: 12, max: 24 });
});

test("availability counts free rooms per type: 12 rooms in 5 types", () => {
  const db = openDb(":memory:");
  const all = searchAvailability(db, { checkIn: "2030-02-01", checkOut: "2030-02-03" }, NOW);
  assert.deepEqual(
    all.map((t) => [t.slug, t.freeRooms, t.maxGuests]),
    [
      ["luxury-suite", 1, 2],
      ["super-deluxe-king", 4, 2],
      ["executive-twin", 1, 2],
      ["standard-king", 2, 2],
      ["standard-twin", 4, 2],
    ],
  );
});

test("3 guests in 2 rooms is one booking with two stays; the rooms leave availability", () => {
  const db = openDb(":memory:");
  const b = book(db, [
    { roomTypeSlug: "standard-twin", guests: 2 },
    { roomTypeSlug: "standard-twin", guests: 1 },
  ]);
  assert.match(b.reference, /^DRH-[A-Z2-9]{6}$/);
  assert.deepEqual(b.rooms.map((r) => [r.roomNumber, r.guests]), [[202, 2], [204, 1]]);
  assert.equal(b.quote.subtotalPaise, 2 * 2 * 250000);
  assert.equal(b.quote.totalPaise, b.quote.subtotalPaise); // no discount, no tax slabs seeded
  assert.equal(b.cancellationDeadline, "2030-01-30T08:30:00Z"); // 1 Feb 14:00 IST minus 48 h
  assert.equal(free(db, "standard-twin"), 2);
  // a stay that only touches the check-out day does not clash
  assert.equal(free(db, "standard-twin", "2030-02-03", "2030-02-05"), 4);
  const row = db.prepare("SELECT status, manage_token_hash h FROM bookings").get() as { status: string; h: string };
  assert.equal(row.status, "pending_payment");
  assert.notEqual(row.h, b.manageToken); // only the hash is stored
});

test("asking for more rooms of a type than are free books nothing", () => {
  const db = openDb(":memory:");
  book(db, [{ roomTypeSlug: "luxury-suite", guests: 2 }]);
  assert.throws(
    () => book(db, [
      { roomTypeSlug: "standard-king", guests: 1 },
      { roomTypeSlug: "luxury-suite", guests: 1 },
    ]),
    UnavailableError,
  );
  assert.equal(free(db, "standard-king"), 2); // the whole booking rolled back
  assert.equal((db.prepare("SELECT COUNT(*) n FROM bookings").get() as { n: number }).n, 1);
});

test("more guests than a room holds, or an empty room, is rejected", () => {
  const db = openDb(":memory:");
  assert.throws(() => book(db, [{ roomTypeSlug: "standard-twin", guests: 3 }]), UnavailableError);
  assert.throws(() => book(db, [{ roomTypeSlug: "standard-twin", guests: 0 }]), ValidationError);
  assert.throws(() => book(db, []), ValidationError);
});

test("the whole house: 12 rooms for 24 guests, then nothing is left", () => {
  const db = openDb(":memory:");
  const rooms = searchAvailability(db, { checkIn: "2030-02-01", checkOut: "2030-02-03" }, NOW)
    .flatMap((t) => Array.from({ length: t.freeRooms }, () => ({ roomTypeSlug: t.slug, guests: 2 })));
  assert.equal(rooms.length, 12);
  assert.equal(book(db, rooms).rooms.length, 12);
  assert.throws(() => book(db, [{ roomTypeSlug: "standard-twin", guests: 1 }]), UnavailableError);
});

test("the night discount applies to every room; tax is per room slab", () => {
  const db = openDb(":memory:");
  db.exec("INSERT INTO tax_slabs (label, from_nightly_paise, rate_bp) VALUES ('GST 0%', 0, 0), ('GST 5%', 100001, 500)");
  const q = quoteStay(db, { checkIn: "2030-02-01", checkOut: "2030-02-08" }, [
    { roomTypeSlug: "luxury-suite", guests: 2 },
    { roomTypeSlug: "standard-twin", guests: 1 },
  ], NOW);
  assert.equal(q.nights, 7);
  assert.equal(q.discountBp, 1000);
  assert.equal(q.subtotalPaise, 7 * (500000 + 250000));
  assert.equal(q.discountPaise, 525000);
  assert.equal(q.taxPaise, bp5(7 * 450000) + bp5(7 * 225000));
  assert.deepEqual(q.taxBreakdown.map((t) => t.label), ["GST 5%"]);
  assert.equal(q.totalPaise, q.subtotalPaise - q.discountPaise + q.taxPaise);
});
const bp5 = (n: number) => Math.round(n * 0.05);

test("past or reversed dates are rejected", () => {
  const db = openDb(":memory:");
  assert.throws(() => searchAvailability(db, { checkIn: "2029-12-30", checkOut: "2030-01-02" }, NOW), ValidationError);
  assert.throws(() => searchAvailability(db, { checkIn: "2030-02-03", checkOut: "2030-02-03" }, NOW), ValidationError);
  assert.throws(() => searchAvailability(db, { checkIn: "2030-02-30", checkOut: "2030-03-02" }, NOW), ValidationError);
});
