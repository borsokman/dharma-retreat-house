-- =====================================================================
-- Dharma Retreat House: booking database schema (SQLite 3.37+)
-- =====================================================================
-- Conventions
--   * Money: integer paise (Rs 3,500 = 350000). Never REAL. All money is INR.
--   * Rates, discounts, taxes: integer basis points (1000 = 10%, 250 = 2.5%).
--   * Stay dates: 'YYYY-MM-DD' text, hotel-local. A stay holds the NIGHTS from
--     check_in_date up to, but NOT including, check_out_date.
--   * Timestamps: UTC ISO-8601 text, e.g. '2030-01-10T08:30:00Z'.
--   * The app sets PRAGMA foreign_keys = ON on EVERY connection and
--     PRAGMA journal_mode = WAL once (see src/db.ts). They are not in this file
--     because journal_mode cannot change inside a transaction.
--   * Bookings are never deleted. They are cancelled. Hence ON DELETE RESTRICT.
--   * A room stay holds its room only while BOTH are true: the booking status is
--     "blocking" (anything except cancelled, no_show, expired) AND the stay row
--     (booking_rooms.status) is 'active'. Cancelling one room of a booking sets
--     only that row to 'cancelled'.

-- ---------------------------------------------------------------------
-- settings: exactly one row, edited by staff in the dashboard
-- ---------------------------------------------------------------------
CREATE TABLE settings (
    id                         INTEGER PRIMARY KEY CHECK (id = 1),
    check_in_time              TEXT    NOT NULL DEFAULT '14:00',
    check_out_time             TEXT    NOT NULL DEFAULT '12:00',
    cancellation_window_hours  INTEGER NOT NULL DEFAULT 48 CHECK (cancellation_window_hours >= 0),
    late_cancellation_nights   INTEGER NOT NULL DEFAULT 1  CHECK (late_cancellation_nights >= 0),  -- charged PER ROOM
    timezone                   TEXT    NOT NULL DEFAULT 'Asia/Kolkata',
    CHECK (check_in_time  GLOB '[0-2][0-9]:[0-5][0-9]' AND time(check_in_time)  IS NOT NULL),
    CHECK (check_out_time GLOB '[0-2][0-9]:[0-5][0-9]' AND time(check_out_time) IS NOT NULL),
    -- Same-day turnover (leave 12:00, arrive 14:00) only works if check-out
    -- is earlier than check-in. The booking logic compares dates only.
    CHECK (check_out_time < check_in_time)
) STRICT;

INSERT INTO settings (id) VALUES (1);

-- ---------------------------------------------------------------------
-- room_types and rooms
-- ---------------------------------------------------------------------
CREATE TABLE room_types (
    id                     INTEGER PRIMARY KEY,
    slug                   TEXT    NOT NULL UNIQUE,   -- used by the frontend
    name                   TEXT    NOT NULL UNIQUE,
    price_per_night_paise  INTEGER NOT NULL CHECK (price_per_night_paise > 0)
) STRICT;

CREATE TABLE rooms (
    id            INTEGER PRIMARY KEY,
    room_number   INTEGER NOT NULL UNIQUE,
    room_type_id  INTEGER NOT NULL REFERENCES room_types(id) ON DELETE RESTRICT,
    max_guests    INTEGER NOT NULL DEFAULT 2 CHECK (max_guests BETWEEN 1 AND 10),
    status        TEXT    NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'out_of_service'))
) STRICT;

-- ---------------------------------------------------------------------
-- discount_tiers and tax_slabs: edited by staff
-- ---------------------------------------------------------------------
-- The discount for a booking is the row with the highest min_nights that is
-- <= the number of nights, and it applies to EVERY room in the booking.
-- Nights = last check-out minus first check-in, so the booking's stays must be
-- one continuous block: the app must reject edits that leave a gap, otherwise
-- the span over-counts. Staff can add, edit or delete tiers freely: existing
-- bookings keep the discount_bp they were booked with.
CREATE TABLE discount_tiers (
    id          INTEGER PRIMARY KEY,
    min_nights  INTEGER NOT NULL UNIQUE CHECK (min_nights >= 1),
    discount_bp INTEGER NOT NULL CHECK (discount_bp BETWEEN 1 AND 10000)
) STRICT;

-- Indian GST on hotel rooms depends on the nightly room value, so tax is a set
-- of SLABS, not one flat rate. A room's rate is the slab with the highest
-- from_nightly_paise that is <= its nightly value:
--     SELECT rate_bp FROM tax_slabs
--     WHERE from_nightly_paise <= :nightly_paise
--     ORDER BY from_nightly_paise DESC LIMIT 1;
-- Tax is computed per room per night, so one booking can mix rates (e.g. a
-- suite at one slab and a twin at another). No row found = no tax; leave the
-- table EMPTY if the hotel is not GST-registered.
-- Intentionally NOT seeded: slabs change by law and a wrong rate silently
-- mischarges every guest. Confirm with your CA, then fill. Example only
-- (sources describing the 22 Sep 2025 change; slab boundaries are "above Rs 1,000"
-- and "above Rs 7,500", hence the 1-paise offsets):
--     INSERT INTO tax_slabs (label, from_nightly_paise, rate_bp) VALUES
--         ('GST 0%', 0, 0), ('GST 5%', 100001, 500), ('GST 18%', 750001, 1800);
CREATE TABLE tax_slabs (
    id                  INTEGER PRIMARY KEY,
    label               TEXT    NOT NULL UNIQUE,
    from_nightly_paise  INTEGER NOT NULL UNIQUE CHECK (from_nightly_paise >= 0),
    rate_bp             INTEGER NOT NULL CHECK (rate_bp BETWEEN 0 AND 10000)
) STRICT;

-- ---------------------------------------------------------------------
-- staff_users
-- ---------------------------------------------------------------------
CREATE TABLE staff_users (
    id             INTEGER PRIMARY KEY,
    email          TEXT    NOT NULL UNIQUE,
    name           TEXT    NOT NULL,
    password_hash  TEXT    NOT NULL,                  -- argon2/bcrypt hash, never plain text
    role           TEXT    NOT NULL DEFAULT 'staff' CHECK (role IN ('admin', 'staff')),
    is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at     TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
) STRICT;

-- ---------------------------------------------------------------------
-- bookings: one per guest reservation. Prices are SNAPSHOTS taken at booking
-- time, so later changes to room prices, tiers or tax slabs never alter them.
-- The money columns describe the ACTIVE rooms only. The app must recompute them
-- whenever stays change, including after a partial cancellation. Cancellation
-- fees live on the cancelled booking_rooms rows, not here.
-- ---------------------------------------------------------------------
CREATE TABLE bookings (
    id                        INTEGER PRIMARY KEY,
    reference                 TEXT    NOT NULL UNIQUE,   -- public booking code
    manage_token_hash         TEXT    NOT NULL,          -- hash of the manage-booking link token
    status                    TEXT    NOT NULL DEFAULT 'pending_payment'
                              CHECK (status IN ('pending_payment', 'confirmed', 'checked_in',
                                                'checked_out', 'cancelled', 'no_show', 'expired')),
    source                    TEXT    NOT NULL DEFAULT 'website'
                              CHECK (source IN ('website', 'staff')),

    guest_name                TEXT    NOT NULL,
    guest_email               TEXT    NOT NULL,
    guest_phone               TEXT    NOT NULL,
    special_requests          TEXT,
    staff_notes               TEXT,

    subtotal_paise            INTEGER NOT NULL CHECK (subtotal_paise >= 0),  -- room nights at snapshot rates
    discount_bp               INTEGER NOT NULL DEFAULT 0 CHECK (discount_bp BETWEEN 0 AND 10000),
    discount_paise            INTEGER NOT NULL DEFAULT 0 CHECK (discount_paise >= 0),
    tax_paise                 INTEGER NOT NULL DEFAULT 0 CHECK (tax_paise >= 0),
    tax_breakdown             TEXT    NOT NULL DEFAULT '[]' CHECK (json_valid(tax_breakdown)),
                                      -- one line per slab used: label, rate_bp, amount_paise
    total_paise               INTEGER NOT NULL CHECK (total_paise >= 0),

    hold_expires_at           TEXT,    -- unpaid pending_payment bookings: a job sets status 'expired' after this

    created_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),

    CHECK (total_paise = subtotal_paise - discount_paise + tax_paise)
) STRICT;

CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_email  ON bookings(guest_email);

-- ---------------------------------------------------------------------
-- booking_rooms: one row per room per stay segment. Dates live here, so a
-- prolonged stay can continue in another room and a room switch mid-stay
-- is just two rows of the same booking.
-- ---------------------------------------------------------------------
CREATE TABLE booking_rooms (
    id                      INTEGER PRIMARY KEY,
    booking_id              INTEGER NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    room_id                 INTEGER NOT NULL REFERENCES rooms(id)    ON DELETE RESTRICT,
    check_in_date           TEXT    NOT NULL,
    check_out_date          TEXT    NOT NULL,
    guests                  INTEGER NOT NULL CHECK (guests >= 1),
    nightly_rate_paise      INTEGER NOT NULL CHECK (nightly_rate_paise > 0),   -- snapshot
    status                  TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
    -- UTC; this row's check-in date + check-in time - window, computed by the app
    cancellation_deadline   TEXT,
    cancelled_at            TEXT,
    cancelled_by            TEXT    CHECK (cancelled_by IN ('guest', 'staff')),
    -- Charged PER ROOM, computed by the app when the row is cancelled late (or on a no-show):
    -- nightly_rate_paise * MIN(late_cancellation_nights, nights of this row), plus tax.
    -- Staff may override it (e.g. a planned room switch creates two rows).
    cancellation_fee_paise  INTEGER NOT NULL DEFAULT 0 CHECK (cancellation_fee_paise >= 0),
    -- date(x) IS x is true only for a valid, zero-padded ISO date
    CHECK (date(check_in_date)  IS check_in_date),
    CHECK (date(check_out_date) IS check_out_date),
    CHECK (check_out_date > check_in_date),
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL))
) STRICT;

CREATE INDEX idx_booking_rooms_room_dates ON booking_rooms(room_id, check_in_date, check_out_date);
CREATE INDEX idx_booking_rooms_booking    ON booking_rooms(booking_id);

-- The stays that currently hold their room (see the rule at the top of this file).
-- Every availability check below goes through this one view, so the rule lives in
-- one place. SQLite inlines the view, so the room/date index is still used.
CREATE VIEW v_holding_stays AS
SELECT br.*
FROM booking_rooms br JOIN bookings b ON b.id = br.booking_id
WHERE br.status = 'active'
  AND b.status NOT IN ('cancelled', 'no_show', 'expired');

-- Two stays on the same room overlap only if they share a night:
--     existing.check_in < new.check_out  AND  existing.check_out > new.check_in
-- Triggers enforce this inside the same write that SQLite already serialises,
-- so two simultaneous requests cannot both win. The app should catch the
-- error and show "room no longer available".
-- (One trigger per event: SQLite has no INSERT-or-UPDATE trigger.)

CREATE TRIGGER trg_booking_rooms_ins
BEFORE INSERT ON booking_rooms
WHEN NEW.status = 'active'
 AND (SELECT status FROM bookings WHERE id = NEW.booking_id)
     NOT IN ('cancelled', 'no_show', 'expired')
BEGIN
    SELECT RAISE(ABORT, 'room is out of service')
    WHERE (SELECT status FROM rooms WHERE id = NEW.room_id) <> 'active';

    SELECT RAISE(ABORT, 'more guests than the room allows')
    WHERE NEW.guests > (SELECT max_guests FROM rooms WHERE id = NEW.room_id);

    SELECT RAISE(ABORT, 'room already booked for these dates')
    WHERE EXISTS (
        SELECT 1 FROM v_holding_stays o
        WHERE o.room_id = NEW.room_id
          AND o.check_in_date  < NEW.check_out_date
          AND o.check_out_date > NEW.check_in_date
    );
END;

-- Also fires when a cancelled row is brought back to 'active'.
CREATE TRIGGER trg_booking_rooms_upd
BEFORE UPDATE OF room_id, check_in_date, check_out_date, guests, status ON booking_rooms
WHEN NEW.status = 'active'
 AND (SELECT status FROM bookings WHERE id = NEW.booking_id)
     NOT IN ('cancelled', 'no_show', 'expired')
BEGIN
    -- only when moving to a different room or being reinstated (dates of an existing
    -- stay may be edited even if the room was later taken out of service)
    SELECT RAISE(ABORT, 'room is out of service')
    WHERE (NEW.room_id <> OLD.room_id OR OLD.status <> 'active')
      AND (SELECT status FROM rooms WHERE id = NEW.room_id) <> 'active';

    SELECT RAISE(ABORT, 'more guests than the room allows')
    WHERE NEW.guests > (SELECT max_guests FROM rooms WHERE id = NEW.room_id);

    SELECT RAISE(ABORT, 'room already booked for these dates')
    WHERE EXISTS (
        SELECT 1 FROM v_holding_stays o
        WHERE o.room_id = NEW.room_id
          AND o.id <> OLD.id
          AND o.check_in_date  < NEW.check_out_date
          AND o.check_out_date > NEW.check_in_date
    );
END;

-- Partial cancellation. A room can be cancelled only before the stay starts;
-- once guests are in, shorten the stay (edit check_out_date) instead.
CREATE TRIGGER trg_booking_rooms_cancel_guard
BEFORE UPDATE OF status ON booking_rooms
WHEN NEW.status = 'cancelled' AND OLD.status = 'active'
BEGIN
    SELECT RAISE(ABORT, 'booking has started: shorten the stay instead of cancelling')
    WHERE (SELECT status FROM bookings WHERE id = NEW.booking_id) IN ('checked_in', 'checked_out');
END;

-- When the last active room of a booking is cancelled, the booking is cancelled too.
CREATE TRIGGER trg_booking_rooms_cancel_sync
AFTER UPDATE OF status ON booking_rooms
WHEN NEW.status = 'cancelled' AND OLD.status = 'active'
BEGIN
    UPDATE bookings SET status = 'cancelled'
    WHERE id = NEW.booking_id
      AND status IN ('pending_payment', 'confirmed')
      AND NOT EXISTS (SELECT 1 FROM booking_rooms
                      WHERE booking_id = NEW.booking_id AND status = 'active');
END;

-- Un-cancelling a booking must re-check its active rooms: someone else may have
-- taken them in the meantime. (Rows that were cancelled one by one stay cancelled
-- until staff reactivate them, and that update re-checks them too.)
CREATE TRIGGER trg_bookings_reinstate
BEFORE UPDATE OF status ON bookings
WHEN OLD.status IN ('cancelled', 'no_show', 'expired')
 AND NEW.status NOT IN ('cancelled', 'no_show', 'expired')
BEGIN
    SELECT RAISE(ABORT, 'cannot reinstate: a room is no longer free')
    WHERE EXISTS (
        SELECT 1
        FROM booking_rooms br
        JOIN v_holding_stays o ON o.room_id = br.room_id AND o.id <> br.id
                              AND o.check_in_date  < br.check_out_date
                              AND o.check_out_date > br.check_in_date
        WHERE br.booking_id = NEW.id AND br.status = 'active'
    );
END;

-- Guards on rooms. "today" is hotel-local (UTC + 5:30, India has no DST).
-- Staff must move guests first; a room is never silently emptied.
CREATE TRIGGER trg_rooms_out_of_service_guard
BEFORE UPDATE OF status ON rooms
WHEN NEW.status = 'out_of_service' AND OLD.status <> 'out_of_service'
BEGIN
    SELECT RAISE(ABORT, 'room has current or future bookings: move them first')
    WHERE EXISTS (
        SELECT 1 FROM v_holding_stays br
        WHERE br.room_id = NEW.id
          AND br.check_out_date > date('now', '+330 minutes')
    );
END;

CREATE TRIGGER trg_rooms_capacity_guard
BEFORE UPDATE OF max_guests ON rooms
WHEN NEW.max_guests < OLD.max_guests
BEGIN
    SELECT RAISE(ABORT, 'a current or future booking has more guests than this')
    WHERE EXISTS (
        SELECT 1 FROM v_holding_stays br
        WHERE br.room_id = NEW.id
          AND br.check_out_date > date('now', '+330 minutes')
          AND br.guests > NEW.max_guests
    );
END;

-- ---------------------------------------------------------------------
-- payments: what was requested and received for a booking.
-- Balances are DERIVED, never stored.
-- A payment request sent to the guest is a 'pending' online row with a payment_url;
-- cash/card/UPI at reception is recorded by staff as 'completed'.
-- ---------------------------------------------------------------------
CREATE TABLE payments (
    id                 INTEGER PRIMARY KEY,
    booking_id         INTEGER NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
    kind               TEXT    NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment', 'refund')),
    amount_paise       INTEGER NOT NULL CHECK (amount_paise > 0),
    method             TEXT    NOT NULL CHECK (method IN ('online', 'cash', 'card', 'upi', 'bank_transfer')),
    status             TEXT    NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
    payment_url        TEXT,
    gateway_reference  TEXT    UNIQUE,
    recorded_by        INTEGER REFERENCES staff_users(id) ON DELETE RESTRICT,   -- NULL = guest/online
    note               TEXT,
    created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    completed_at       TEXT,
    CHECK ((status = 'completed') = (completed_at IS NOT NULL))
) STRICT;

CREATE INDEX idx_payments_booking ON payments(booking_id);

-- ---------------------------------------------------------------------
-- audit_log: who changed what. Write one row for every staff edit
-- (dates, room switch, prolong, cancel, price/discount/settings change).
-- ---------------------------------------------------------------------
CREATE TABLE audit_log (
    id             INTEGER PRIMARY KEY,
    at             TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    staff_user_id  INTEGER REFERENCES staff_users(id) ON DELETE RESTRICT,  -- NULL = guest or system
    action         TEXT    NOT NULL,        -- e.g. 'booking.room_switched'
    entity         TEXT    NOT NULL,        -- 'booking', 'room', 'room_type', 'tax_slab', 'settings', ...
    entity_id      INTEGER,
    details        TEXT    NOT NULL DEFAULT '{}' CHECK (json_valid(details))   -- before/after values
) STRICT;

CREATE INDEX idx_audit_entity ON audit_log(entity, entity_id);

-- ---------------------------------------------------------------------
-- Views for the staff dashboard (not tables)
-- ---------------------------------------------------------------------
CREATE VIEW v_room_stays AS
SELECT r.room_number, t.name AS room_type, r.status AS room_status,
       br.check_in_date, br.check_out_date, br.guests, br.status AS stay_status,
       br.cancellation_deadline,
       b.id AS booking_id, b.reference, b.status AS booking_status,
       b.guest_name, b.guest_phone
FROM booking_rooms br
JOIN bookings   b ON b.id = br.booking_id
JOIN rooms      r ON r.id = br.room_id
JOIN room_types t ON t.id = r.room_type_id;

-- Dates, room counts and the deadline use ACTIVE rooms; a fully cancelled booking
-- falls back to its cancelled rows so the dashboard still shows its dates.
-- amount due = money of the active rooms + all cancellation/no-show fees.
CREATE VIEW v_booking_summary AS
WITH agg AS (
    SELECT b.id, b.reference, b.status, b.guest_name, b.guest_email, b.guest_phone,
           b.total_paise,
           COALESCE(MIN(CASE WHEN br.status = 'active' THEN br.check_in_date END),
                    MIN(br.check_in_date))  AS check_in_date,
           COALESCE(MAX(CASE WHEN br.status = 'active' THEN br.check_out_date END),
                    MAX(br.check_out_date)) AS check_out_date,
           COUNT(CASE WHEN br.status = 'active'    THEN 1 END) AS rooms,
           COUNT(CASE WHEN br.status = 'cancelled' THEN 1 END) AS cancelled_rooms,
           MIN(CASE WHEN br.status = 'active' THEN br.cancellation_deadline END) AS cancellation_deadline,
           COALESCE(SUM(br.cancellation_fee_paise), 0) AS cancellation_fees_paise
    FROM bookings b
    LEFT JOIN booking_rooms br ON br.booking_id = b.id
    GROUP BY b.id
),
due AS (
    SELECT agg.*,
           CAST(julianday(check_out_date) - julianday(check_in_date) AS INTEGER) AS nights,
           (CASE WHEN status IN ('cancelled', 'no_show', 'expired')
                 THEN cancellation_fees_paise
                 ELSE total_paise + cancellation_fees_paise END) AS amount_due_paise,
           COALESCE((SELECT SUM(CASE p.kind WHEN 'payment' THEN p.amount_paise ELSE -p.amount_paise END)
                     FROM payments p
                     WHERE p.booking_id = agg.id AND p.status = 'completed'), 0) AS paid_paise
    FROM agg
)
SELECT id, reference, status, guest_name, guest_email, guest_phone,
       check_in_date, check_out_date, nights, rooms, cancelled_rooms, cancellation_deadline,
       cancellation_fees_paise, amount_due_paise, paid_paise,
       amount_due_paise - paid_paise AS balance_paise
FROM due;

-- ---------------------------------------------------------------------
-- Seed data. ROOM PRICES ARE PLACEHOLDERS: replace with real rates.
-- ---------------------------------------------------------------------
INSERT INTO room_types (slug, name, price_per_night_paise) VALUES
    ('luxury-suite',      'Luxury Suite',      500000),
    ('super-deluxe-king', 'Super Deluxe King', 400000),
    ('executive-twin',    'Executive Twin',    350000),
    ('standard-king',     'Standard King',     300000),
    ('standard-twin',     'Standard Twin',     250000);

INSERT INTO rooms (room_number, room_type_id)
SELECT n, (SELECT id FROM room_types WHERE slug = s)
FROM (
    SELECT 205 AS n, 'luxury-suite' AS s UNION ALL
    SELECT 201, 'super-deluxe-king' UNION ALL
    SELECT 203, 'super-deluxe-king' UNION ALL
    SELECT 208, 'super-deluxe-king' UNION ALL
    SELECT 210, 'super-deluxe-king' UNION ALL
    SELECT 212, 'executive-twin'    UNION ALL
    SELECT 206, 'standard-king'     UNION ALL
    SELECT 207, 'standard-king'     UNION ALL
    SELECT 202, 'standard-twin'     UNION ALL
    SELECT 204, 'standard-twin'     UNION ALL
    SELECT 209, 'standard-twin'     UNION ALL
    SELECT 211, 'standard-twin'
);

INSERT INTO discount_tiers (min_nights, discount_bp) VALUES
    (7, 1000), (14, 2000), (21, 3000);

-- ---------------------------------------------------------------------
-- Example: free rooms of a type for [:check_in, :check_out)
-- ---------------------------------------------------------------------
-- SELECT r.room_number
-- FROM rooms r JOIN room_types t ON t.id = r.room_type_id
-- WHERE t.slug = :slug
--   AND r.status = 'active'
--   AND NOT EXISTS (
--       SELECT 1 FROM v_holding_stays br
--       WHERE br.room_id = r.id
--         AND br.check_in_date  < :check_out
--         AND br.check_out_date > :check_in)
-- ORDER BY r.room_number;
