import Database from "better-sqlite3";
import type { Db } from "./db.js";

export class ValidationError extends Error {}
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

// ---- helpers ---------------------------------------------------------------

/** Every staff edit writes one audit_log row in the SAME transaction as the edit. */
export function audit(
  db: Db,
  staffUserId: number | null,
  action: string,
  entity: string,
  entityId: number | null,
  details: unknown,
): void {
  db.prepare(
    "INSERT INTO audit_log (staff_user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)",
  ).run(staffUserId, action, entity, entityId, JSON.stringify(details));
}

/** Prices, discounts, taxes and settings may only be changed by an active admin. */
export function assertAdmin(db: Db, staffUserId: number): void {
  const u = db
    .prepare("SELECT role, is_active FROM staff_users WHERE id = ?")
    .get(staffUserId) as { role: string; is_active: number } | undefined;
  if (!u || u.is_active !== 1 || u.role !== "admin") {
    throw new ForbiddenError("only an active admin can change this");
  }
}

/** Turn a violated CHECK/UNIQUE/FOREIGN KEY constraint into a ValidationError (HTTP 400 later). */
function asValidation(e: unknown): never {
  if (e instanceof Database.SqliteError && e.code.startsWith("SQLITE_CONSTRAINT")) {
    throw new ValidationError(e.message);
  }
  throw e;
}

// ---- settings --------------------------------------------------------------

const SETTINGS_COLUMNS = {
  checkInTime: "check_in_time",
  checkOutTime: "check_out_time",
  cancellationWindowHours: "cancellation_window_hours",
  lateCancellationNights: "late_cancellation_nights",
  timezone: "timezone",
  dinnerMaxCovers: "dinner_max_covers",
  dinnerPricePerPersonPaise: "dinner_price_per_person_paise",
  dinnerCancellationHours: "dinner_cancellation_hours",
} as const;

export type SettingKey = keyof typeof SETTINGS_COLUMNS;
export type Settings = Record<SettingKey, string | number>;
export type SettingsPatch = Partial<Settings>;

export function getSettings(db: Db): Settings {
  const row = db.prepare("SELECT * FROM settings WHERE id = 1").get() as Record<string, string | number>;
  const out = {} as Settings;
  for (const [key, column] of Object.entries(SETTINGS_COLUMNS)) {
    out[key as SettingKey] = row[column]!;
  }
  return out;
}

/**
 * Staff edit of policy values. This is one UPDATE on the single settings row:
 * nothing is recreated. The table's CHECK constraints (e.g. check-out must be earlier
 * than check-in) reject bad values, and the transaction leaves everything unchanged.
 */
export function updateSettings(db: Db, staffUserId: number, patch: SettingsPatch): Settings {
  const keys = Object.keys(patch) as SettingKey[];
  for (const k of keys) {
    if (!(k in SETTINGS_COLUMNS)) throw new ValidationError(`unknown setting: ${k}`);
  }
  return db.transaction(() => {
    assertAdmin(db, staffUserId);
    const before = getSettings(db);
    if (keys.length > 0) {
      // column names come from the whitelist above; values go through bound parameters
      const assignments = keys.map((k) => `${SETTINGS_COLUMNS[k]} = @${k}`).join(", ");
      try {
        db.prepare(`UPDATE settings SET ${assignments} WHERE id = 1`).run(patch);
      } catch (e) {
        asValidation(e);
      }
    }
    const after = getSettings(db);
    const changed = Object.fromEntries(
      keys.filter((k) => before[k] !== after[k]).map((k) => [k, { from: before[k], to: after[k] }]),
    );
    if (Object.keys(changed).length > 0) audit(db, staffUserId, "settings.updated", "settings", 1, changed);
    return after;
  })();
}

// ---- room prices -----------------------------------------------------------

/**
 * Change a room type's nightly price (integer paise). Existing bookings are NOT touched:
 * each booking_rooms row keeps the nightly_rate_paise it was booked at.
 */
export function updateRoomTypePrice(
  db: Db,
  staffUserId: number,
  roomTypeId: number,
  pricePerNightPaise: number,
): void {
  if (!Number.isInteger(pricePerNightPaise) || pricePerNightPaise <= 0) {
    throw new ValidationError("price must be a positive whole number of paise");
  }
  db.transaction(() => {
    assertAdmin(db, staffUserId);
    const before = db
      .prepare("SELECT price_per_night_paise AS p FROM room_types WHERE id = ?")
      .get(roomTypeId) as { p: number } | undefined;
    if (!before) throw new NotFoundError(`room type ${roomTypeId} not found`);
    db.prepare("UPDATE room_types SET price_per_night_paise = ? WHERE id = ?").run(
      pricePerNightPaise,
      roomTypeId,
    );
    audit(db, staffUserId, "room_type.price_changed", "room_type", roomTypeId, {
      from: before.p,
      to: pricePerNightPaise,
    });
  })();
}
