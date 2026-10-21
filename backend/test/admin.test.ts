import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, type Db } from "../src/db.js";
import {
  getSettings, updateSettings, updateRoomTypePrice,
  ValidationError, ForbiddenError,
} from "../src/admin.js";

function tmpFile(): string {
  return join(mkdtempSync(join(tmpdir(), "hotel-")), "hotel.db");
}
function addStaff(db: Db, role: "admin" | "staff"): number {
  return Number(
    db.prepare("INSERT INTO staff_users (email, name, password_hash, role) VALUES (?, 'T', 'x', ?)")
      .run(`${role}-${Math.random()}@x.in`, role).lastInsertRowid,
  );
}
const count = (db: Db, sql: string) => (db.prepare(sql).get() as { n: number }).n;

test("opening an existing database never recreates it: data survives, version stays", () => {
  const file = tmpFile();
  let db = openDb(file);
  assert.equal(db.pragma("user_version", { simple: true }), 1);
  const admin = addStaff(db, "admin");
  updateRoomTypePrice(db, admin, 1, 777000);
  db.close();

  db = openDb(file); // second start of the app
  assert.equal(db.pragma("user_version", { simple: true }), 1);
  assert.equal(count(db, "SELECT COUNT(*) n FROM rooms"), 12);
  assert.equal(count(db, "SELECT price_per_night_paise n FROM room_types WHERE id = 1"), 777000);
  assert.equal(count(db, "SELECT COUNT(*) n FROM staff_users"), 1);
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  db.close();
});

test("a staff settings edit is one UPDATE plus one audit row", () => {
  const db = openDb(":memory:");
  const admin = addStaff(db, "admin");
  assert.equal(getSettings(db).dinnerCancellationHours, 12);

  const after = updateSettings(db, admin, { dinnerCancellationHours: 24, dinnerMaxCovers: 20 });
  assert.equal(after.dinnerCancellationHours, 24);
  assert.equal(after.dinnerMaxCovers, 20);
  assert.equal(count(db, "SELECT COUNT(*) n FROM settings"), 1);

  const log = db.prepare("SELECT action, staff_user_id, details FROM audit_log").get() as
    { action: string; staff_user_id: number; details: string };
  assert.equal(log.action, "settings.updated");
  assert.equal(log.staff_user_id, admin);
  assert.deepEqual(JSON.parse(log.details), {
    dinnerCancellationHours: { from: 12, to: 24 },
    dinnerMaxCovers: { from: 0, to: 20 },
  });
});

test("an invalid edit is rejected and leaves settings and audit log untouched", () => {
  const db = openDb(":memory:");
  const admin = addStaff(db, "admin");
  assert.throws(() => updateSettings(db, admin, { checkOutTime: "15:00" }), ValidationError); // later than check-in
  assert.throws(() => updateSettings(db, admin, { checkInTime: "2pm" }), ValidationError);
  assert.throws(() => updateSettings(db, admin, { bogus: 1 } as never), ValidationError);
  // two changes in one request: the valid one must roll back with the invalid one
  assert.throws(() => updateSettings(db, admin, { dinnerMaxCovers: 30, checkOutTime: "15:00" }), ValidationError);
  assert.equal(getSettings(db).checkOutTime, "12:00");
  assert.equal(getSettings(db).dinnerMaxCovers, 0);
  assert.equal(count(db, "SELECT COUNT(*) n FROM audit_log"), 0);
});

test("only an active admin can change settings or prices", () => {
  const db = openDb(":memory:");
  const staff = addStaff(db, "staff");
  assert.throws(() => updateSettings(db, staff, { dinnerMaxCovers: 5 }), ForbiddenError);
  assert.throws(() => updateRoomTypePrice(db, staff, 1, 1000), ForbiddenError);
  assert.throws(() => updateRoomTypePrice(db, 9999, 1, 1000), ForbiddenError);
  const admin = addStaff(db, "admin");
  db.prepare("UPDATE staff_users SET is_active = 0 WHERE id = ?").run(admin);
  assert.throws(() => updateSettings(db, admin, { dinnerMaxCovers: 5 }), ForbiddenError);
});

test("changing a room price does not change existing bookings", () => {
  const db = openDb(":memory:");
  const admin = addStaff(db, "admin");
  const roomId = (db.prepare("SELECT id FROM rooms WHERE room_number = 202").get() as { id: number }).id;
  const bookingId = Number(
    db.prepare(`INSERT INTO bookings (reference, manage_token_hash, guest_name, guest_email, guest_phone,
                                      subtotal_paise, total_paise)
                VALUES ('B1', 'h', 'G', 'g@x.in', '1', 250000, 250000)`).run().lastInsertRowid,
  );
  db.prepare(`INSERT INTO booking_rooms (booking_id, room_id, check_in_date, check_out_date, guests, nightly_rate_paise)
              VALUES (?, ?, '2030-01-16', '2030-01-17', 2, 250000)`).run(bookingId, roomId);

  const typeId = (db.prepare(`SELECT room_type_id t FROM rooms WHERE id = ?`).get(roomId) as { t: number }).t;
  updateRoomTypePrice(db, admin, typeId, 999000);

  assert.equal(count(db, "SELECT nightly_rate_paise n FROM booking_rooms"), 250000); // old booking unchanged
  assert.equal(count(db, `SELECT price_per_night_paise n FROM room_types WHERE id = ${typeId}`), 999000);
  assert.throws(() => updateRoomTypePrice(db, admin, typeId, 0), ValidationError);
  assert.throws(() => updateRoomTypePrice(db, admin, typeId, 99.5), ValidationError);
});

test("migrations: each file runs once, in order; gaps are refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "mig-"));
  copyFileSync(join(import.meta.dirname, "..", "migrations", "001_init.sql"), join(dir, "001_init.sql"));
  writeFileSync(join(dir, "002_add_note.sql"), "ALTER TABLE rooms ADD COLUMN note TEXT;");
  const file = tmpFile();

  let db = openDb(file, dir);
  assert.equal(db.pragma("user_version", { simple: true }), 2);
  db.prepare("UPDATE rooms SET note = 'new mattress' WHERE room_number = 201").run();
  db.close();

  db = openDb(file, dir); // 002 must NOT run again (it would fail: duplicate column)
  assert.equal(db.pragma("user_version", { simple: true }), 2);
  assert.equal(count(db, "SELECT COUNT(*) n FROM rooms WHERE note = 'new mattress'"), 1);
  db.close();

  const gapDir = mkdtempSync(join(tmpdir(), "gap-"));
  copyFileSync(join(dir, "001_init.sql"), join(gapDir, "001_init.sql"));
  writeFileSync(join(gapDir, "003_skipped.sql"), "SELECT 1;");
  assert.throws(() => openDb(tmpFile(), gapDir), /migration gap/);
});
