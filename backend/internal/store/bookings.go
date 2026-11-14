package store

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"math"
	"regexp"
	"sort"
	"strings"
	"time"
)

// ---- input shapes ----------------------------------------------------------------

// StayDates: the nights from CheckIn up to, but not including, CheckOut.
// Both are 'YYYY-MM-DD', hotel-local.
type StayDates struct {
	CheckIn  string
	CheckOut string
}

// RoomRequest is one room of a booking: its type, and how many guests sleep in it.
type RoomRequest struct {
	RoomTypeSlug string
	Guests       int
}

type Contact struct {
	Name  string
	Email string
	Phone string
}

type BookingRequest struct {
	StayDates
	Rooms           []RoomRequest
	Contact         Contact
	SpecialRequests string
}

// ---- dates -----------------------------------------------------------------------

func parseDate(s string) (time.Time, bool) {
	t, err := time.Parse(dateLayout, s)
	return t, err == nil && t.Format(dateLayout) == s
}

// nightsBetween validates the stay's shape (not whether it is in the past).
func nightsBetween(d StayDates) (int, error) {
	in, ok1 := parseDate(d.CheckIn)
	out, ok2 := parseDate(d.CheckOut)
	if !ok1 || !ok2 {
		return 0, invalid("dates must be valid YYYY-MM-DD dates")
	}
	if !out.After(in) {
		return 0, invalid("check-out must be after check-in")
	}
	return int(out.Sub(in).Hours() / 24), nil
}

// NightsOf validates a stay a guest asks for and returns its number of nights.
func NightsOf(d StayDates, now time.Time) (int, error) {
	n, err := nightsBetween(d)
	if err != nil {
		return 0, err
	}
	if d.CheckIn < HotelToday(now) {
		return 0, invalid("check-in cannot be in the past")
	}
	return n, nil
}

// RoomCountRange: how many rooms a party may book. Every room needs at least one
// guest and may not hold more than maxPerRoom, so 3 guests (2 per room) take 2 or 3.
func RoomCountRange(guests, maxPerRoom int) (min, max int) {
	return (guests + maxPerRoom - 1) / maxPerRoom, guests
}

// ---- availability ----------------------------------------------------------------

type TypeAvailability struct {
	Slug               string
	Name               string
	PricePerNightPaise int64
	MaxGuests          int // largest party one room of this type can take
	FreeRooms          int // rooms of this type free for EVERY night of the stay
}

// freeRoom is true for room r when it is in service and no holding stay shares a
// night with [checkIn, checkOut). Takes two parameters: checkOut, checkIn.
const freeRoom = `
  r.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM v_holding_stays br
    WHERE br.room_id = r.id
      AND br.check_in_date  < ?
      AND br.check_out_date > ?)`

// SearchAvailability counts free rooms per room type, most expensive type first.
// Rooms staff took out of service never count, so they never reach the booking form.
func (s *Store) SearchAvailability(ctx context.Context, d StayDates) ([]TypeAvailability, error) {
	if _, err := NightsOf(d, s.Now()); err != nil {
		return nil, err
	}
	rows, err := s.DB.QueryContext(ctx, `
		SELECT t.slug, t.name, t.price_per_night_paise,
		       (SELECT COALESCE(MAX(max_guests), 0) FROM rooms
		         WHERE room_type_id = t.id AND status = 'active'),
		       (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = t.id AND `+freeRoom+`)
		FROM room_types t
		ORDER BY t.price_per_night_paise DESC, t.name`, d.CheckOut, d.CheckIn)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TypeAvailability
	for rows.Next() {
		var t TypeAvailability
		if err := rows.Scan(&t.Slug, &t.Name, &t.PricePerNightPaise, &t.MaxGuests, &t.FreeRooms); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// RoomTypes lists every room type with its current price.
func (s *Store) RoomTypes(ctx context.Context) ([]TypeAvailability, error) {
	rows, err := s.DB.QueryContext(ctx, `
		SELECT t.slug, t.name, t.price_per_night_paise,
		       (SELECT COALESCE(MAX(max_guests), 0) FROM rooms WHERE room_type_id = t.id),
		       (SELECT COUNT(*) FROM rooms r WHERE r.room_type_id = t.id AND r.status = 'active')
		FROM room_types t ORDER BY t.price_per_night_paise DESC, t.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []TypeAvailability
	for rows.Next() {
		var t TypeAvailability
		if err := rows.Scan(&t.Slug, &t.Name, &t.PricePerNightPaise, &t.MaxGuests, &t.FreeRooms); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// ---- prices ------------------------------------------------------------------------

type QuoteLine struct {
	RoomTypeSlug     string
	RoomTypeName     string
	Guests           int
	NightlyRatePaise int64
	AmountPaise      int64 // nights * nightly rate, before discount and tax
	DiscountPaise    int64
	TaxPaise         int64
	TaxLabel         string // "" = no tax slab applies
	TaxRateBp        int64
}

type TaxLine struct {
	Label       string `json:"label"`
	RateBp      int64  `json:"rate_bp"`
	AmountPaise int64  `json:"amount_paise"`
}

type Quote struct {
	Nights        int
	Lines         []QuoteLine
	SubtotalPaise int64
	DiscountBp    int64
	DiscountPaise int64
	TaxBreakdown  []TaxLine // one line per tax slab used
	TaxPaise      int64
	TotalPaise    int64
}

// bp applies basis points, rounding half away from zero like Math.round for positives.
func bp(paise, basisPoints int64) int64 {
	return int64(math.Round(float64(paise) * float64(basisPoints) / 10000))
}

type queryer interface {
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
}

func discountFor(ctx context.Context, q queryer, nights int) (int64, error) {
	var d int64
	err := q.QueryRowContext(ctx,
		"SELECT discount_bp FROM discount_tiers WHERE min_nights <= ? ORDER BY min_nights DESC LIMIT 1",
		nights).Scan(&d)
	if err == sql.ErrNoRows {
		return 0, nil
	}
	return d, err
}

// taxSlab returns the slab for a nightly value, or "" when none applies.
func taxSlab(ctx context.Context, q queryer, nightlyPaise int64) (string, int64, error) {
	var label string
	var rate int64
	err := q.QueryRowContext(ctx,
		"SELECT label, rate_bp FROM tax_slabs WHERE from_nightly_paise <= ? ORDER BY from_nightly_paise DESC LIMIT 1",
		nightlyPaise).Scan(&label, &rate)
	if err == sql.ErrNoRows {
		return "", 0, nil
	}
	return label, rate, err
}

// priceLine prices one room for a stay: discount first, then the tax slab of the
// discounted nightly rate. Every line is rounded on its own, so totals always satisfy
// total = subtotal - discount + tax (the CHECK on bookings).
func priceLine(ctx context.Context, q queryer, line *QuoteLine, nights int, discountBp int64) error {
	line.AmountPaise = line.NightlyRatePaise * int64(nights)
	line.DiscountPaise = bp(line.AmountPaise, discountBp)
	label, rate, err := taxSlab(ctx, q, line.NightlyRatePaise-bp(line.NightlyRatePaise, discountBp))
	if err != nil {
		return err
	}
	line.TaxLabel, line.TaxRateBp = label, rate
	line.TaxPaise = 0
	if label != "" {
		line.TaxPaise = bp(line.AmountPaise-line.DiscountPaise, rate)
	}
	return nil
}

func sumLines(q *Quote) {
	q.TaxBreakdown = []TaxLine{}
	q.SubtotalPaise, q.DiscountPaise, q.TaxPaise = 0, 0, 0
	for _, l := range q.Lines {
		q.SubtotalPaise += l.AmountPaise
		q.DiscountPaise += l.DiscountPaise
		q.TaxPaise += l.TaxPaise
		if l.TaxLabel == "" {
			continue
		}
		found := false
		for i := range q.TaxBreakdown {
			if q.TaxBreakdown[i].Label == l.TaxLabel {
				q.TaxBreakdown[i].AmountPaise += l.TaxPaise
				found = true
			}
		}
		if !found {
			q.TaxBreakdown = append(q.TaxBreakdown, TaxLine{l.TaxLabel, l.TaxRateBp, l.TaxPaise})
		}
	}
	q.TotalPaise = q.SubtotalPaise - q.DiscountPaise + q.TaxPaise
}

// QuoteStay prices a stay of one or more rooms with the CURRENT rates, discount
// tiers and tax slabs. The discount tier follows the number of nights and applies
// to every room.
func (s *Store) QuoteStay(ctx context.Context, d StayDates, rooms []RoomRequest) (*Quote, error) {
	return quoteStay(ctx, s.DB, d, rooms, s.Now())
}

func quoteStay(ctx context.Context, q queryer, d StayDates, rooms []RoomRequest, now time.Time) (*Quote, error) {
	nights, err := NightsOf(d, now)
	if err != nil {
		return nil, err
	}
	if len(rooms) == 0 {
		return nil, invalid("choose at least one room")
	}
	discount, err := discountFor(ctx, q, nights)
	if err != nil {
		return nil, err
	}
	out := &Quote{Nights: nights, DiscountBp: discount}
	for _, req := range rooms {
		if req.Guests < 1 {
			return nil, invalid("every room needs at least one guest")
		}
		line := QuoteLine{RoomTypeSlug: req.RoomTypeSlug, Guests: req.Guests}
		err := q.QueryRowContext(ctx, "SELECT name, price_per_night_paise FROM room_types WHERE slug = ?",
			req.RoomTypeSlug).Scan(&line.RoomTypeName, &line.NightlyRatePaise)
		if err == sql.ErrNoRows {
			return nil, invalid("unknown room type: %s", req.RoomTypeSlug)
		}
		if err != nil {
			return nil, err
		}
		if err := priceLine(ctx, q, &line, nights, discount); err != nil {
			return nil, err
		}
		out.Lines = append(out.Lines, line)
	}
	sumLines(out)
	return out, nil
}

// ---- creating a booking -----------------------------------------------------------

type CreatedBooking struct {
	BookingID            int64
	Reference            string
	ManageToken          string // goes into the guest's manage link; only its hash is stored
	CancellationDeadline string
	Rooms                []AssignedRoom
	Quote                *Quote
}

type AssignedRoom struct {
	RoomNumber   int
	RoomTypeSlug string
	Guests       int
}

const refAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O, 1/I

func newReference() string {
	b := make([]byte, 6)
	rand.Read(b)
	for i := range b {
		b[i] = refAlphabet[int(b[i])%len(refAlphabet)]
	}
	return "DRH-" + string(b)
}

func randomToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

// HashToken is how manage links and staff sessions are stored: SHA-256, hex.
func HashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

var emailRe = regexp.MustCompile(`^\S+@\S+\.\S+$`)

// cancellationDeadline: the check-in date at check-in time (IST), minus the window.
func cancellationDeadline(ctx context.Context, q queryer, checkIn string) (string, error) {
	var at string
	var hours int
	if err := q.QueryRowContext(ctx,
		"SELECT check_in_time, cancellation_window_hours FROM settings WHERE id = 1").Scan(&at, &hours); err != nil {
		return "", err
	}
	t, err := time.ParseInLocation("2006-01-02 15:04", checkIn+" "+at, ist)
	if err != nil {
		return "", err
	}
	return utcISO(t.Add(-time.Duration(hours) * time.Hour)), nil
}

// CreateBooking books one or more rooms for one party in a single transaction. For
// every requested room it picks the lowest-numbered free room of that type that
// holds the requested guests, never the same room twice; the biggest parties pick
// first. The booking starts as 'pending_payment': with no payment provider yet,
// staff confirm it in the dashboard once the guest has paid.
//
// The transaction holds the write lock from its first read, and the overlap
// trigger is the final guard, so the loser of a race gets an UnavailableError.
func (s *Store) CreateBooking(ctx context.Context, req BookingRequest) (*CreatedBooking, error) {
	c := Contact{strings.TrimSpace(req.Contact.Name), strings.TrimSpace(req.Contact.Email), strings.TrimSpace(req.Contact.Phone)}
	if c.Name == "" || c.Phone == "" || !emailRe.MatchString(c.Email) {
		return nil, invalid("name, a valid email and a phone number are required")
	}
	out := &CreatedBooking{ManageToken: randomToken(24)}
	err := s.tx(ctx, func(tx *sql.Tx) error {
		quote, err := quoteStay(ctx, tx, req.StayDates, req.Rooms, s.Now())
		if err != nil {
			return err
		}
		out.Quote = quote
		if out.CancellationDeadline, err = cancellationDeadline(ctx, tx, req.CheckIn); err != nil {
			return err
		}

		order := make([]int, len(quote.Lines))
		for i := range order {
			order[i] = i
		}
		sort.SliceStable(order, func(a, b int) bool { return quote.Lines[order[a]].Guests > quote.Lines[order[b]].Guests })
		picked := make([]struct {
			id     int64
			number int
		}, len(quote.Lines))
		taken := []int64{}
		for _, i := range order {
			line := quote.Lines[i]
			takenJSON, _ := json.Marshal(taken)
			err := tx.QueryRowContext(ctx, `
				SELECT r.id, r.room_number FROM rooms r
				JOIN room_types t ON t.id = r.room_type_id
				WHERE t.slug = ? AND r.max_guests >= ? AND `+freeRoom+`
				  AND r.id NOT IN (SELECT value FROM json_each(?))
				ORDER BY r.max_guests, r.room_number LIMIT 1`,
				line.RoomTypeSlug, line.Guests, req.CheckOut, req.CheckIn, string(takenJSON),
			).Scan(&picked[i].id, &picked[i].number)
			if err == sql.ErrNoRows {
				return &UnavailableError{"not enough " + line.RoomTypeName + " rooms are free for these dates"}
			}
			if err != nil {
				return err
			}
			taken = append(taken, picked[i].id)
		}

		breakdown, _ := json.Marshal(quote.TaxBreakdown)
		var special any
		if v := strings.TrimSpace(req.SpecialRequests); v != "" {
			special = v
		}
		for attempt := 0; ; attempt++ {
			out.Reference = newReference()
			res, err := tx.ExecContext(ctx, `
				INSERT INTO bookings (reference, manage_token_hash, guest_name, guest_email, guest_phone,
				  special_requests, subtotal_paise, discount_bp, discount_paise, tax_paise, tax_breakdown, total_paise)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				out.Reference, HashToken(out.ManageToken), c.Name, c.Email, c.Phone, special,
				quote.SubtotalPaise, quote.DiscountBp, quote.DiscountPaise, quote.TaxPaise, string(breakdown), quote.TotalPaise)
			if err == nil {
				out.BookingID, _ = res.LastInsertId()
				break
			}
			if !strings.Contains(err.Error(), "UNIQUE constraint failed: bookings.reference") || attempt >= 4 {
				return err
			}
		}

		for i, line := range quote.Lines {
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO booking_rooms (booking_id, room_id, check_in_date, check_out_date, guests,
				                           nightly_rate_paise, cancellation_deadline)
				VALUES (?, ?, ?, ?, ?, ?, ?)`,
				out.BookingID, picked[i].id, req.CheckIn, req.CheckOut, line.Guests,
				line.NightlyRatePaise, out.CancellationDeadline); err != nil {
				return err
			}
			out.Rooms = append(out.Rooms, AssignedRoom{picked[i].number, line.RoomTypeSlug, line.Guests})
		}
		return nil
	})
	if err != nil {
		err = fromTrigger(err)
		if _, ok := err.(*UnavailableError); ok && !strings.HasPrefix(err.Error(), "not enough") {
			err = &UnavailableError{"a room was just taken: please search again"}
		}
		return nil, err
	}
	return out, nil
}

// ---- reading bookings -------------------------------------------------------------

// Booking is one reservation as staff (and, trimmed, the guest) see it.
type Booking struct {
	ID                    int64
	Reference             string
	Status                string
	Source                string
	GuestName             string
	GuestEmail            string
	GuestPhone            string
	SpecialRequests       string
	StaffNotes            string
	CheckIn               string // active rooms; a fully cancelled booking shows its cancelled ones
	CheckOut              string
	Nights                int
	Guests                int
	Stays                 []Stay
	SubtotalPaise         int64
	DiscountBp            int64
	DiscountPaise         int64
	TaxPaise              int64
	TaxBreakdown          []TaxLine
	TotalPaise            int64
	CancellationDeadline  string
	CancellationFeesPaise int64
	AmountDuePaise        int64
	PaidPaise             int64
	BalancePaise          int64
	CreatedAt             string
}

// Stay is one room of a booking (a booking_rooms row).
type Stay struct {
	ID                   int64
	RoomID               int64
	RoomNumber           int
	RoomType             string
	RoomTypeSlug         string
	CheckIn              string
	CheckOut             string
	Guests               int
	NightlyRatePaise     int64
	Status               string // active | cancelled
	CancellationFeePaise int64
}

// loadBookings reads bookings matching a WHERE clause on v_booking_summary (alias s)
// joined with bookings (alias b), with their stays, in the given order.
func loadBookings(ctx context.Context, q queryer, where, order string, args ...any) ([]Booking, error) {
	rows, err := q.QueryContext(ctx, `
		SELECT s.id, s.reference, s.status, b.source, s.guest_name, s.guest_email, s.guest_phone,
		       COALESCE(b.special_requests, ''), COALESCE(b.staff_notes, ''),
		       COALESCE(s.check_in_date, ''), COALESCE(s.check_out_date, ''), COALESCE(s.nights, 0),
		       b.subtotal_paise, b.discount_bp, b.discount_paise, b.tax_paise, b.tax_breakdown, b.total_paise,
		       COALESCE(s.cancellation_deadline, ''), s.cancellation_fees_paise,
		       s.amount_due_paise, s.paid_paise, s.balance_paise, b.created_at
		FROM v_booking_summary s JOIN bookings b ON b.id = s.id
		WHERE `+where+` ORDER BY `+order, args...)
	if err != nil {
		return nil, err
	}
	var list []Booking
	index := map[int64]int{}
	for rows.Next() {
		var b Booking
		var breakdown string
		if err := rows.Scan(&b.ID, &b.Reference, &b.Status, &b.Source, &b.GuestName, &b.GuestEmail, &b.GuestPhone,
			&b.SpecialRequests, &b.StaffNotes, &b.CheckIn, &b.CheckOut, &b.Nights,
			&b.SubtotalPaise, &b.DiscountBp, &b.DiscountPaise, &b.TaxPaise, &breakdown, &b.TotalPaise,
			&b.CancellationDeadline, &b.CancellationFeesPaise,
			&b.AmountDuePaise, &b.PaidPaise, &b.BalancePaise, &b.CreatedAt); err != nil {
			rows.Close()
			return nil, err
		}
		json.Unmarshal([]byte(breakdown), &b.TaxBreakdown)
		if b.TaxBreakdown == nil {
			b.TaxBreakdown = []TaxLine{}
		}
		b.Stays = []Stay{}
		index[b.ID] = len(list)
		list = append(list, b)
	}
	rows.Close()
	if err := rows.Err(); err != nil || len(list) == 0 {
		return list, err
	}

	ids := make([]int64, 0, len(list))
	for _, b := range list {
		ids = append(ids, b.ID)
	}
	idsJSON, _ := json.Marshal(ids)
	stays, err := q.QueryContext(ctx, `
		SELECT br.booking_id, br.id, r.id, r.room_number, t.name, t.slug, br.check_in_date, br.check_out_date,
		       br.guests, br.nightly_rate_paise, br.status, br.cancellation_fee_paise
		FROM booking_rooms br
		JOIN rooms r ON r.id = br.room_id
		JOIN room_types t ON t.id = r.room_type_id
		WHERE br.booking_id IN (SELECT value FROM json_each(?))
		ORDER BY br.status, br.check_in_date, r.room_number`, string(idsJSON))
	if err != nil {
		return nil, err
	}
	defer stays.Close()
	for stays.Next() {
		var bookingID int64
		var st Stay
		if err := stays.Scan(&bookingID, &st.ID, &st.RoomID, &st.RoomNumber, &st.RoomType, &st.RoomTypeSlug,
			&st.CheckIn, &st.CheckOut, &st.Guests, &st.NightlyRatePaise, &st.Status, &st.CancellationFeePaise); err != nil {
			return nil, err
		}
		b := &list[index[bookingID]]
		b.Stays = append(b.Stays, st)
		if st.Status == "active" || b.Status == "cancelled" {
			b.Guests += st.Guests
		}
	}
	return list, stays.Err()
}

func loadBooking(ctx context.Context, q queryer, id int64) (*Booking, error) {
	list, err := loadBookings(ctx, q, "s.id = ?", "s.id", id)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		return nil, &NotFoundError{"booking not found"}
	}
	return &list[0], nil
}

// bookingByToken finds a booking by its reference and manage-link token. A wrong
// token and an unknown reference give the same answer.
func bookingByToken(ctx context.Context, q queryer, reference, token string) (int64, error) {
	var id int64
	var hash string
	err := q.QueryRowContext(ctx, "SELECT id, manage_token_hash FROM bookings WHERE reference = ?",
		strings.ToUpper(strings.TrimSpace(reference))).Scan(&id, &hash)
	if err == sql.ErrNoRows || (err == nil && subtle.ConstantTimeCompare([]byte(hash), []byte(HashToken(token))) != 1) {
		return 0, &NotFoundError{"no booking matches this reference and code"}
	}
	return id, err
}

// GuestBooking is the manage-booking lookup.
func (s *Store) GuestBooking(ctx context.Context, reference, token string) (*Booking, error) {
	id, err := bookingByToken(ctx, s.DB, reference, token)
	if err != nil {
		return nil, err
	}
	return loadBooking(ctx, s.DB, id)
}

// GuestCancel cancels every room of a booking from the guest's manage link.
// Before the deadline it is free; after it, each room is charged the late fee:
// late_cancellation_nights of its nightly rate (at most its nights), plus tax.
func (s *Store) GuestCancel(ctx context.Context, reference, token string) (*Booking, error) {
	var out *Booking
	err := s.tx(ctx, func(tx *sql.Tx) error {
		id, err := bookingByToken(ctx, tx, reference, token)
		if err != nil {
			return err
		}
		b, err := loadBooking(ctx, tx, id)
		if err != nil {
			return err
		}
		if b.Status != "pending_payment" && b.Status != "confirmed" {
			return invalid("this booking can no longer be cancelled online: please contact the hotel")
		}
		if err := cancelStays(ctx, tx, b, "guest", nil, s.Now()); err != nil {
			return err
		}
		if err := audit(ctx, tx, nil, "booking.cancelled_by_guest", "booking", id, "{}"); err != nil {
			return err
		}
		out, err = loadBooking(ctx, tx, id)
		return err
	})
	return out, fromTrigger(err)
}

// cancelStays cancels the booking's active rooms. Late (after a room's deadline),
// guests pay the late fee; staff cancellations are free.
func cancelStays(ctx context.Context, tx *sql.Tx, b *Booking, by string, staffID *int64, now time.Time) error {
	var lateNights int64
	if err := tx.QueryRowContext(ctx, "SELECT late_cancellation_nights FROM settings WHERE id = 1").Scan(&lateNights); err != nil {
		return err
	}
	late := b.CancellationDeadline != "" && utcISO(now) > b.CancellationDeadline
	for _, st := range b.Stays {
		if st.Status != "active" {
			continue
		}
		var fee int64
		if by == "guest" && late {
			nights, _ := nightsBetween(StayDates{st.CheckIn, st.CheckOut})
			fee = st.NightlyRatePaise * min(lateNights, int64(nights))
			if label, rate, err := taxSlab(ctx, tx, st.NightlyRatePaise); err != nil {
				return err
			} else if label != "" {
				fee += bp(fee, rate)
			}
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE booking_rooms SET status = 'cancelled', cancelled_at = ?, cancelled_by = ?, cancellation_fee_paise = ?
			WHERE id = ?`, utcISO(now), by, fee, st.ID); err != nil {
			return err
		}
	}
	return nil
}

// recomputeMoney re-prices a booking from its ACTIVE rooms, keeping the discount
// it was booked with. Called when staff change a room at the new room's rate.
func recomputeMoney(ctx context.Context, tx *sql.Tx, bookingID int64) error {
	b, err := loadBooking(ctx, tx, bookingID)
	if err != nil {
		return err
	}
	q := &Quote{DiscountBp: b.DiscountBp}
	for _, st := range b.Stays {
		if st.Status != "active" {
			continue
		}
		nights, _ := nightsBetween(StayDates{st.CheckIn, st.CheckOut})
		line := QuoteLine{NightlyRatePaise: st.NightlyRatePaise}
		if err := priceLine(ctx, tx, &line, nights, b.DiscountBp); err != nil {
			return err
		}
		q.Lines = append(q.Lines, line)
	}
	if len(q.Lines) == 0 {
		return nil
	}
	sumLines(q)
	breakdown, _ := json.Marshal(q.TaxBreakdown)
	_, err = tx.ExecContext(ctx, `
		UPDATE bookings SET subtotal_paise = ?, discount_paise = ?, tax_paise = ?, tax_breakdown = ?, total_paise = ?
		WHERE id = ?`, q.SubtotalPaise, q.DiscountPaise, q.TaxPaise, string(breakdown), q.TotalPaise, bookingID)
	return err
}
