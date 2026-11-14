package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
)

// Everything here is a staff action: the caller passes the signed-in staff
// member's id, and every change writes an audit_log row in the same transaction.

// ---- booking lists -----------------------------------------------------------------

const openStatuses = "('pending_payment', 'confirmed', 'checked_in')"

// BookingViews are the dashboard's tabs. Each is a WHERE clause on v_booking_summary
// (s); "?" is today's hotel date.
var bookingViews = map[string]struct {
	where string
	order string
	today int // how many times today's date is a parameter
}{
	"upcoming":   {"s.status IN " + openStatuses + " AND s.check_out_date >= ?", "s.check_in_date, s.reference", 1},
	"arrivals":   {"s.status IN ('pending_payment', 'confirmed', 'checked_in') AND s.check_in_date = ?", "s.guest_name", 1},
	"departures": {"s.status IN ('confirmed', 'checked_in', 'checked_out') AND s.check_out_date = ?", "s.guest_name", 1},
	"in_house":   {"s.status = 'checked_in'", "s.check_out_date, s.guest_name", 0},
	"past":       {"s.status IN ('checked_out', 'no_show') OR (s.status IN " + openStatuses + " AND s.check_out_date < ?)", "s.check_in_date DESC", 1},
	"cancelled":  {"s.status IN ('cancelled', 'expired')", "s.check_in_date DESC", 0},
	"all":        {"1 = 1", "s.check_in_date DESC", 0},
}

// StaffBookings lists bookings for one dashboard tab, optionally filtered by a
// search on reference, guest name, email, phone or room number.
func (s *Store) StaffBookings(ctx context.Context, view, search string) ([]Booking, error) {
	v, ok := bookingViews[view]
	if !ok {
		return nil, invalid("unknown view: %s", view)
	}
	where := "(" + v.where + ")"
	var args []any
	for i := 0; i < v.today; i++ {
		args = append(args, HotelToday(s.Now()))
	}
	if q := strings.TrimSpace(search); q != "" {
		like := "%" + strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(strings.ToLower(q)) + "%"
		where += ` AND (lower(s.reference) LIKE ? ESCAPE '\' OR lower(s.guest_name) LIKE ? ESCAPE '\'
		            OR lower(s.guest_email) LIKE ? ESCAPE '\' OR lower(s.guest_phone) LIKE ? ESCAPE '\'
		            OR EXISTS (SELECT 1 FROM booking_rooms x JOIN rooms xr ON xr.id = x.room_id
		                       WHERE x.booking_id = s.id AND CAST(xr.room_number AS TEXT) LIKE ? ESCAPE '\'))`
		args = append(args, like, like, like, like, like)
	}
	list, err := loadBookings(ctx, s.DB, where, v.order, args...)
	if list == nil {
		list = []Booking{}
	}
	return list, err
}

// TodayCounts are the numbers at the top of the dashboard.
type TodayCounts struct {
	Date        string
	Arrivals    int
	Departures  int
	InHouse     int
	RoomsFree   int // in service and not held tonight
	OutOfOrder  int
	AwaitingPay int
}

func (s *Store) Today(ctx context.Context) (*TodayCounts, error) {
	today := HotelToday(s.Now())
	tomorrow := addDays(today, 1)
	c := &TodayCounts{Date: today}
	err := s.DB.QueryRowContext(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM v_booking_summary WHERE status IN `+openStatuses+` AND check_in_date = ?),
		  (SELECT COUNT(*) FROM v_booking_summary WHERE status IN ('confirmed', 'checked_in', 'checked_out') AND check_out_date = ?),
		  (SELECT COUNT(*) FROM bookings WHERE status = 'checked_in'),
		  (SELECT COUNT(*) FROM rooms r WHERE `+freeRoom+`),
		  (SELECT COUNT(*) FROM rooms WHERE status = 'out_of_service'),
		  (SELECT COUNT(*) FROM v_booking_summary WHERE status = 'pending_payment' AND check_out_date >= ?)`,
		today, today, tomorrow, today, today,
	).Scan(&c.Arrivals, &c.Departures, &c.InHouse, &c.RoomsFree, &c.OutOfOrder, &c.AwaitingPay)
	return c, err
}

func addDays(date string, n int) string {
	t, _ := parseDate(date)
	return t.AddDate(0, 0, n).Format(dateLayout)
}

// ---- one booking ---------------------------------------------------------------------

type AuditEntry struct {
	At      string
	Staff   string // "" = guest or system
	Action  string
	Details string // JSON
}

// StaffBooking is one booking with its change history, newest first.
func (s *Store) StaffBooking(ctx context.Context, id int64) (*Booking, []AuditEntry, error) {
	b, err := loadBooking(ctx, s.DB, id)
	if err != nil {
		return nil, nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT a.at, COALESCE(u.name, ''), a.action, a.details
		FROM audit_log a LEFT JOIN staff_users u ON u.id = a.staff_user_id
		WHERE a.entity = 'booking' AND a.entity_id = ?
		ORDER BY a.id DESC`, id)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()
	history := []AuditEntry{}
	for rows.Next() {
		var e AuditEntry
		if err := rows.Scan(&e.At, &e.Staff, &e.Action, &e.Details); err != nil {
			return nil, nil, err
		}
		history = append(history, e)
	}
	return b, history, rows.Err()
}

func detailsJSON(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// statusMoves: which status a booking may move to from each status. The undo moves
// (checked_in → confirmed, checked_out → checked_in) fix a wrong click.
var statusMoves = map[string][]string{
	"pending_payment": {"confirmed", "cancelled"},
	"confirmed":       {"checked_in", "no_show", "cancelled", "pending_payment"},
	"checked_in":      {"checked_out", "confirmed"},
	"checked_out":     {"checked_in"},
	"cancelled":       {"confirmed"},
	"no_show":         {"confirmed"},
	"expired":         {"confirmed"},
}

// AllowedStatuses lists the statuses a booking can be moved to from status.
func AllowedStatuses(status string) []string {
	if m := statusMoves[status]; m != nil {
		return m
	}
	return []string{}
}

// SetBookingStatus moves a booking along its lifecycle. Cancelling marks every
// active room cancelled by staff (no fee); reinstating brings them back, and the
// schema's triggers refuse if someone else has taken a room meanwhile.
func (s *Store) SetBookingStatus(ctx context.Context, staffID, id int64, status string) (*Booking, error) {
	var out *Booking
	err := s.tx(ctx, func(tx *sql.Tx) error {
		b, err := loadBooking(ctx, tx, id)
		if err != nil {
			return err
		}
		allowed := false
		for _, m := range AllowedStatuses(b.Status) {
			allowed = allowed || m == status
		}
		if !allowed {
			return invalid("a %s booking cannot be marked %s", strings.ReplaceAll(b.Status, "_", " "), strings.ReplaceAll(status, "_", " "))
		}
		today := HotelToday(s.Now())
		switch {
		case status == "checked_in" && b.CheckIn > today:
			return invalid("check-in is on %s: guests cannot be checked in before their arrival date", b.CheckIn)
		case status == "cancelled":
			if err := cancelStays(ctx, tx, b, "staff", &staffID, s.Now()); err != nil {
				return err
			}
		case b.Status == "cancelled" || b.Status == "expired" || b.Status == "no_show":
			if b.CheckOut <= today {
				return invalid("this stay is over and cannot be reinstated")
			}
			if _, err := tx.ExecContext(ctx, "UPDATE bookings SET status = ? WHERE id = ?", status, id); err != nil {
				return err
			}
			// rooms cancelled with the booking come back; the update trigger re-checks each
			if _, err := tx.ExecContext(ctx, `
				UPDATE booking_rooms SET status = 'active', cancelled_at = NULL, cancelled_by = NULL, cancellation_fee_paise = 0
				WHERE booking_id = ? AND status = 'cancelled'`, id); err != nil {
				return err
			}
		}
		if status != "cancelled" && !(b.Status == "cancelled" || b.Status == "expired" || b.Status == "no_show") {
			if _, err := tx.ExecContext(ctx, "UPDATE bookings SET status = ? WHERE id = ?", status, id); err != nil {
				return err
			}
		}
		if err := audit(ctx, tx, &staffID, "booking.status_changed", "booking", id,
			detailsJSON(map[string]string{"from": b.Status, "to": status})); err != nil {
			return err
		}
		out, err = loadBooking(ctx, tx, id)
		return err
	})
	return out, fromTrigger(err)
}

// SetStaffNotes replaces the booking's internal notes (never shown to the guest).
func (s *Store) SetStaffNotes(ctx context.Context, staffID, id int64, notes string) (*Booking, error) {
	var out *Booking
	notes = strings.TrimSpace(notes)
	if len(notes) > 4000 {
		return nil, invalid("notes may have at most 4000 characters")
	}
	err := s.tx(ctx, func(tx *sql.Tx) error {
		b, err := loadBooking(ctx, tx, id)
		if err != nil {
			return err
		}
		if b.StaffNotes == notes {
			out = b
			return nil
		}
		var v any
		if notes != "" {
			v = notes
		}
		if _, err := tx.ExecContext(ctx, "UPDATE bookings SET staff_notes = ? WHERE id = ?", v, id); err != nil {
			return err
		}
		if err := audit(ctx, tx, &staffID, "booking.notes_changed", "booking", id,
			detailsJSON(map[string]string{"from": b.StaffNotes, "to": notes})); err != nil {
			return err
		}
		out, err = loadBooking(ctx, tx, id)
		return err
	})
	return out, err
}

// ---- moving a guest to another room ----------------------------------------------------

// RoomOption is one physical room as a move target for a stay's dates.
type RoomOption struct {
	RoomNumber         int
	RoomType           string
	PricePerNightPaise int64
	MaxGuests          int
	Status             string // active | out_of_service
	Note               string
	Current            bool   // the stay is in this room now
	Free               bool   // can take this stay
	Reason             string // why not, when not free
}

func stayOf(ctx context.Context, q queryer, bookingID, stayID int64) (*Booking, *Stay, error) {
	b, err := loadBooking(ctx, q, bookingID)
	if err != nil {
		return nil, nil, err
	}
	for i := range b.Stays {
		if b.Stays[i].ID == stayID {
			return b, &b.Stays[i], nil
		}
	}
	return nil, nil, &NotFoundError{"this room is not part of the booking"}
}

// MoveOptions lists every room and whether the stay could move there.
func (s *Store) MoveOptions(ctx context.Context, bookingID, stayID int64) ([]RoomOption, error) {
	_, st, err := stayOf(ctx, s.DB, bookingID, stayID)
	if err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT r.room_number, t.name, t.price_per_night_paise, r.max_guests, r.status, COALESCE(r.status_note, ''),
		       r.id = ?,
		       (SELECT b.reference FROM v_holding_stays o JOIN bookings b ON b.id = o.booking_id
		         WHERE o.room_id = r.id AND o.id <> ? AND o.check_in_date < ? AND o.check_out_date > ?
		         ORDER BY o.check_in_date LIMIT 1)
		FROM rooms r JOIN room_types t ON t.id = r.room_type_id
		ORDER BY r.room_number`, st.RoomID, st.ID, st.CheckOut, st.CheckIn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []RoomOption{}
	for rows.Next() {
		var o RoomOption
		var clash sql.NullString
		if err := rows.Scan(&o.RoomNumber, &o.RoomType, &o.PricePerNightPaise, &o.MaxGuests, &o.Status, &o.Note,
			&o.Current, &clash); err != nil {
			return nil, err
		}
		switch {
		case o.Current:
			o.Reason = "current room"
		case o.Status != "active":
			o.Reason = "out of service"
		case clash.Valid:
			o.Reason = "booked (" + clash.String + ")"
		case o.MaxGuests < st.Guests:
			o.Reason = fmt.Sprintf("holds %d guests", o.MaxGuests)
		default:
			o.Free = true
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// MoveStay puts one room of a booking into another room for the same dates. With
// reprice, the stay takes the new room's current nightly rate and the booking's
// totals are recomputed; otherwise the guest keeps the price they booked
// (a free upgrade, or a downgrade the hotel settles separately).
func (s *Store) MoveStay(ctx context.Context, staffID, bookingID, stayID int64, roomNumber int, reprice bool) (*Booking, error) {
	var out *Booking
	err := s.tx(ctx, func(tx *sql.Tx) error {
		b, st, err := stayOf(ctx, tx, bookingID, stayID)
		if err != nil {
			return err
		}
		if st.Status != "active" {
			return invalid("this room was cancelled")
		}
		switch b.Status {
		case "pending_payment", "confirmed", "checked_in":
		default:
			return invalid("a %s booking cannot change rooms", strings.ReplaceAll(b.Status, "_", " "))
		}
		var roomID, rate int64
		var typeName string
		err = tx.QueryRowContext(ctx, `
			SELECT r.id, t.price_per_night_paise, t.name FROM rooms r JOIN room_types t ON t.id = r.room_type_id
			WHERE r.room_number = ?`, roomNumber).Scan(&roomID, &rate, &typeName)
		if err == sql.ErrNoRows {
			return invalid("there is no room %d", roomNumber)
		}
		if err != nil {
			return err
		}
		if roomID == st.RoomID {
			return invalid("the guests are already in room %d", roomNumber)
		}
		newRate := st.NightlyRatePaise
		if reprice {
			newRate = rate
		}
		// the update trigger refuses an out-of-service, too small or already booked room
		if _, err := tx.ExecContext(ctx, "UPDATE booking_rooms SET room_id = ?, nightly_rate_paise = ? WHERE id = ?",
			roomID, newRate, st.ID); err != nil {
			return err
		}
		if newRate != st.NightlyRatePaise {
			if err := recomputeMoney(ctx, tx, bookingID); err != nil {
				return err
			}
		}
		if err := audit(ctx, tx, &staffID, "booking.room_switched", "booking", bookingID, detailsJSON(map[string]any{
			"stay": st.ID, "from_room": st.RoomNumber, "to_room": roomNumber,
			"from_rate_paise": st.NightlyRatePaise, "to_rate_paise": newRate,
		})); err != nil {
			return err
		}
		out, err = loadBooking(ctx, tx, bookingID)
		return err
	})
	return out, fromTrigger(err)
}

// ---- rooms -------------------------------------------------------------------------------

type StayRef struct {
	BookingID int64
	Reference string
	GuestName string
	CheckIn   string
	CheckOut  string
	Status    string
}

// RoomStatus is one physical room on the dashboard's Rooms tab.
type RoomStatus struct {
	Number    int
	RoomType  string
	TypeSlug  string
	MaxGuests int
	Status    string // active | out_of_service
	Note      string
	Tonight   *StayRef // who holds the room tonight
	Next      *StayRef // the next arrival after tonight
}

func (s *Store) Rooms(ctx context.Context) ([]RoomStatus, error) {
	today := HotelToday(s.Now())
	rows, err := s.DB.QueryContext(ctx, `
		SELECT r.id, r.room_number, t.name, t.slug, r.max_guests, r.status, COALESCE(r.status_note, '')
		FROM rooms r JOIN room_types t ON t.id = r.room_type_id ORDER BY r.room_number`)
	if err != nil {
		return nil, err
	}
	var out []RoomStatus
	var ids []int64
	for rows.Next() {
		var r RoomStatus
		var id int64
		if err := rows.Scan(&id, &r.Number, &r.RoomType, &r.TypeSlug, &r.MaxGuests, &r.Status, &r.Note); err != nil {
			rows.Close()
			return nil, err
		}
		out = append(out, r)
		ids = append(ids, id)
	}
	rows.Close()
	for i, id := range ids {
		if out[i].Tonight, err = stayRef(ctx, s.DB,
			"o.room_id = ? AND o.check_in_date <= ? AND o.check_out_date > ?", "o.check_in_date", id, today, today); err != nil {
			return nil, err
		}
		if out[i].Next, err = stayRef(ctx, s.DB,
			"o.room_id = ? AND o.check_in_date > ?", "o.check_in_date", id, today); err != nil {
			return nil, err
		}
	}
	return out, nil
}

func stayRef(ctx context.Context, q queryer, where, order string, args ...any) (*StayRef, error) {
	var r StayRef
	err := q.QueryRowContext(ctx, `
		SELECT b.id, b.reference, b.guest_name, o.check_in_date, o.check_out_date, b.status
		FROM v_holding_stays o JOIN bookings b ON b.id = o.booking_id
		WHERE `+where+` ORDER BY `+order+` LIMIT 1`, args...).
		Scan(&r.BookingID, &r.Reference, &r.GuestName, &r.CheckIn, &r.CheckOut, &r.Status)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// RoomBusyError: the room cannot go out of service until these bookings move (HTTP 409).
type RoomBusyError struct{ Bookings []StayRef }

func (e *RoomBusyError) Error() string {
	refs := make([]string, len(e.Bookings))
	for i, b := range e.Bookings {
		refs[i] = fmt.Sprintf("%s (%s, from %s)", b.GuestName, b.Reference, b.CheckIn)
	}
	return "guests are still booked into this room: " + strings.Join(refs, "; ") +
		". Move them to another room first (Bookings → Change room)."
}

// SetRoomStatus takes a room out of service (it disappears from the booking form at
// once) or puts it back. A room with current or future guests must be emptied first,
// so nobody's booking silently loses its room.
func (s *Store) SetRoomStatus(ctx context.Context, staffID int64, number int, status, note string) (*RoomStatus, error) {
	if status != "active" && status != "out_of_service" {
		return nil, invalid("status must be active or out_of_service")
	}
	note = strings.TrimSpace(note)
	if len(note) > 200 {
		return nil, invalid("the note may have at most 200 characters")
	}
	err := s.tx(ctx, func(tx *sql.Tx) error {
		var id int64
		var before, beforeNote string
		err := tx.QueryRowContext(ctx, "SELECT id, status, COALESCE(status_note, '') FROM rooms WHERE room_number = ?", number).
			Scan(&id, &before, &beforeNote)
		if err == sql.ErrNoRows {
			return &NotFoundError{fmt.Sprintf("there is no room %d", number)}
		}
		if err != nil {
			return err
		}
		if status == "out_of_service" && before != "out_of_service" {
			busy, err := tx.QueryContext(ctx, `
				SELECT b.id, b.reference, b.guest_name, o.check_in_date, o.check_out_date, b.status
				FROM v_holding_stays o JOIN bookings b ON b.id = o.booking_id
				WHERE o.room_id = ? AND o.check_out_date > ? ORDER BY o.check_in_date`, id, HotelToday(s.Now()))
			if err != nil {
				return err
			}
			var refs []StayRef
			for busy.Next() {
				var r StayRef
				if err := busy.Scan(&r.BookingID, &r.Reference, &r.GuestName, &r.CheckIn, &r.CheckOut, &r.Status); err != nil {
					busy.Close()
					return err
				}
				refs = append(refs, r)
			}
			busy.Close()
			if len(refs) > 0 {
				return &RoomBusyError{refs}
			}
		}
		var v any
		if status == "out_of_service" && note != "" {
			v = note
		}
		if _, err := tx.ExecContext(ctx, "UPDATE rooms SET status = ?, status_note = ? WHERE id = ?", status, v, id); err != nil {
			return err
		}
		return audit(ctx, tx, &staffID, "room.status_changed", "room", id, detailsJSON(map[string]string{
			"from": before, "to": status, "note": note,
		}))
	})
	if err != nil {
		if _, ok := err.(*RoomBusyError); ok {
			return nil, err
		}
		return nil, fromTrigger(err)
	}
	rooms, err := s.Rooms(ctx)
	if err != nil {
		return nil, err
	}
	for i := range rooms {
		if rooms[i].Number == number {
			return &rooms[i], nil
		}
	}
	return nil, &NotFoundError{"room not found"}
}
