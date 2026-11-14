package store

import (
	"context"
	"errors"
	"testing"
	"time"
)

var (
	ctx     = context.Background()
	testNow = time.Date(2030, 1, 1, 6, 0, 0, 0, time.UTC)
	contact = Contact{"Tenzin", "tenzin@example.in", "+91 90000 00000"}
)

func open(t *testing.T) *Store {
	t.Helper()
	s, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	s.Now = func() time.Time { return testNow }
	t.Cleanup(func() { s.Close() })
	return s
}

func book(t *testing.T, s *Store, rooms ...RoomRequest) *CreatedBooking {
	t.Helper()
	b, err := s.CreateBooking(ctx, BookingRequest{StayDates: StayDates{"2030-02-01", "2030-02-03"}, Rooms: rooms, Contact: contact})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func free(t *testing.T, s *Store, slug, in, out string) int {
	t.Helper()
	all, err := s.SearchAvailability(ctx, StayDates{in, out})
	if err != nil {
		t.Fatal(err)
	}
	for _, a := range all {
		if a.Slug == slug {
			return a.FreeRooms
		}
	}
	t.Fatalf("no type %s", slug)
	return 0
}

func admin(t *testing.T, s *Store) int64 {
	t.Helper()
	u, err := s.CreateStaff(ctx, "Desk@Example.com", "Front Desk", "correct horse battery", "admin")
	if err != nil {
		t.Fatal(err)
	}
	return u.ID
}

func isErr[T error](err error) bool {
	var target T
	return errors.As(err, &target)
}

func TestMigrationsRunOnce(t *testing.T) {
	s := open(t)
	if v, err := s.migrate(ctx); err != nil || v != 1 {
		t.Fatalf("second migrate: version %d, err %v", v, err)
	}
}

func TestRoomCountRange(t *testing.T) {
	for _, c := range []struct{ guests, min, max int }{{1, 1, 1}, {2, 1, 2}, {3, 2, 3}, {24, 12, 24}} {
		if mn, mx := RoomCountRange(c.guests, 2); mn != c.min || mx != c.max {
			t.Errorf("%d guests: got %d-%d", c.guests, mn, mx)
		}
	}
}

func TestAvailabilityPerType(t *testing.T) {
	s := open(t)
	all, err := s.SearchAvailability(ctx, StayDates{"2030-02-01", "2030-02-03"})
	if err != nil {
		t.Fatal(err)
	}
	want := map[string]int{"luxury-suite": 1, "super-deluxe-king": 4, "executive-twin": 1, "standard-king": 2, "standard-twin": 4}
	total := 0
	for _, a := range all {
		if a.FreeRooms != want[a.Slug] || a.MaxGuests != 2 {
			t.Errorf("%s: %d free, max %d", a.Slug, a.FreeRooms, a.MaxGuests)
		}
		total += a.FreeRooms
	}
	if total != 12 || all[0].Slug != "luxury-suite" {
		t.Errorf("total %d, first %s", total, all[0].Slug)
	}
}

func TestThreeGuestsInTwoRooms(t *testing.T) {
	s := open(t)
	b := book(t, s, RoomRequest{"standard-twin", 2}, RoomRequest{"standard-twin", 1})
	if len(b.Reference) != 10 || b.Reference[:4] != "DRH-" {
		t.Errorf("reference %q", b.Reference)
	}
	if b.Rooms[0].RoomNumber != 202 || b.Rooms[1].RoomNumber != 204 {
		t.Errorf("rooms %+v", b.Rooms)
	}
	if b.Quote.SubtotalPaise != 2*2*250000 || b.Quote.TotalPaise != b.Quote.SubtotalPaise {
		t.Errorf("quote %+v", b.Quote)
	}
	if b.CancellationDeadline != "2030-01-30T08:30:00Z" { // 1 Feb 14:00 IST minus 48 h
		t.Errorf("deadline %s", b.CancellationDeadline)
	}
	if n := free(t, s, "standard-twin", "2030-02-01", "2030-02-03"); n != 2 {
		t.Errorf("free after booking: %d", n)
	}
	if n := free(t, s, "standard-twin", "2030-02-03", "2030-02-05"); n != 4 {
		t.Errorf("check-out day should not clash: %d", n)
	}
	var status, hash string
	s.DB.QueryRow("SELECT status, manage_token_hash FROM bookings").Scan(&status, &hash)
	if status != "pending_payment" || hash == b.ManageToken || hash != HashToken(b.ManageToken) {
		t.Errorf("status %s, token stored as hash: %v", status, hash != b.ManageToken)
	}
}

func TestOverbookingBooksNothing(t *testing.T) {
	s := open(t)
	book(t, s, RoomRequest{"luxury-suite", 2})
	_, err := s.CreateBooking(ctx, BookingRequest{StayDates: StayDates{"2030-02-01", "2030-02-03"}, Contact: contact,
		Rooms: []RoomRequest{{"standard-king", 1}, {"luxury-suite", 1}}})
	if !isErr[*UnavailableError](err) {
		t.Fatalf("want UnavailableError, got %v", err)
	}
	if n := free(t, s, "standard-king", "2030-02-01", "2030-02-03"); n != 2 {
		t.Errorf("rollback: standard-king free %d", n)
	}
}

func TestGuestCountRules(t *testing.T) {
	s := open(t)
	for _, c := range []struct {
		rooms []RoomRequest
		ok    func(error) bool
	}{
		{[]RoomRequest{{"standard-twin", 3}}, isErr[*UnavailableError]},
		{[]RoomRequest{{"standard-twin", 0}}, isErr[*ValidationError]},
		{nil, isErr[*ValidationError]},
	} {
		_, err := s.CreateBooking(ctx, BookingRequest{StayDates: StayDates{"2030-02-01", "2030-02-03"}, Rooms: c.rooms, Contact: contact})
		if !c.ok(err) {
			t.Errorf("%+v: got %v", c.rooms, err)
		}
	}
}

func TestWholeHouse(t *testing.T) {
	s := open(t)
	all, _ := s.SearchAvailability(ctx, StayDates{"2030-02-01", "2030-02-03"})
	var rooms []RoomRequest
	for _, a := range all {
		for i := 0; i < a.FreeRooms; i++ {
			rooms = append(rooms, RoomRequest{a.Slug, 2})
		}
	}
	if b := book(t, s, rooms...); len(b.Rooms) != 12 {
		t.Fatalf("booked %d rooms", len(b.Rooms))
	}
	_, err := s.CreateBooking(ctx, BookingRequest{StayDates: StayDates{"2030-02-01", "2030-02-03"}, Contact: contact,
		Rooms: []RoomRequest{{"standard-twin", 1}}})
	if !isErr[*UnavailableError](err) {
		t.Fatalf("13th room: %v", err)
	}
}

func TestDiscountAndTax(t *testing.T) {
	s := open(t)
	s.DB.Exec("INSERT INTO tax_slabs (label, from_nightly_paise, rate_bp) VALUES ('GST 0%', 0, 0), ('GST 5%', 100001, 500)")
	q, err := s.QuoteStay(ctx, StayDates{"2030-02-01", "2030-02-08"}, []RoomRequest{{"luxury-suite", 2}, {"standard-twin", 1}})
	if err != nil {
		t.Fatal(err)
	}
	bp5 := func(n int64) int64 { return bp(n, 500) }
	if q.Nights != 7 || q.DiscountBp != 1000 || q.SubtotalPaise != 7*(500000+250000) || q.DiscountPaise != 525000 {
		t.Errorf("quote %+v", q)
	}
	if q.TaxPaise != bp5(7*450000)+bp5(7*225000) || len(q.TaxBreakdown) != 1 || q.TaxBreakdown[0].Label != "GST 5%" {
		t.Errorf("tax %d %+v", q.TaxPaise, q.TaxBreakdown)
	}
	if q.TotalPaise != q.SubtotalPaise-q.DiscountPaise+q.TaxPaise {
		t.Error("total does not add up")
	}
}

func TestBadDates(t *testing.T) {
	s := open(t)
	for _, d := range []StayDates{{"2029-12-30", "2030-01-02"}, {"2030-02-03", "2030-02-03"}, {"2030-02-30", "2030-03-02"}} {
		if _, err := s.SearchAvailability(ctx, d); !isErr[*ValidationError](err) {
			t.Errorf("%+v: %v", d, err)
		}
	}
}

func TestGuestLookupAndCancel(t *testing.T) {
	s := open(t)
	b := book(t, s, RoomRequest{"standard-king", 2})
	if _, err := s.GuestBooking(ctx, b.Reference, "wrong"); !isErr[*NotFoundError](err) {
		t.Fatalf("wrong token: %v", err)
	}
	got, err := s.GuestCancel(ctx, b.Reference, b.ManageToken)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != "cancelled" || got.CancellationFeesPaise != 0 {
		t.Errorf("early cancel: %s fee %d", got.Status, got.CancellationFeesPaise)
	}
	if n := free(t, s, "standard-king", "2030-02-01", "2030-02-03"); n != 2 {
		t.Errorf("room not released: %d", n)
	}

	// after the deadline the first night is charged
	late := book(t, s, RoomRequest{"standard-king", 1})
	s.Now = func() time.Time { return time.Date(2030, 1, 31, 0, 0, 0, 0, time.UTC) }
	got, err = s.GuestCancel(ctx, late.Reference, late.ManageToken)
	if err != nil {
		t.Fatal(err)
	}
	if got.CancellationFeesPaise != 300000 {
		t.Errorf("late fee %d", got.CancellationFeesPaise)
	}
}

// ---- staff ----------------------------------------------------------------------------

func TestStaffLoginAndSessions(t *testing.T) {
	s := open(t)
	admin(t, s)
	if _, err := s.CreateStaff(ctx, "x@example.com", "X", "short", "staff"); !isErr[*ValidationError](err) {
		t.Errorf("short password accepted: %v", err)
	}
	if _, err := s.CreateStaff(ctx, "desk@example.com", "Again", "another long password", "staff"); !isErr[*ValidationError](err) {
		t.Errorf("duplicate email accepted: %v", err)
	}
	if _, _, _, err := s.Login(ctx, "desk@example.com", "wrong password!"); !isErr[*AuthError](err) {
		t.Errorf("wrong password: %v", err)
	}
	if _, _, _, err := s.Login(ctx, "nobody@example.com", "correct horse battery"); !isErr[*AuthError](err) {
		t.Errorf("unknown email: %v", err)
	}
	token, u, expires, err := s.Login(ctx, "  DESK@example.com ", "correct horse battery")
	if err != nil || u.Role != "admin" || !expires.Equal(testNow.Add(SessionLifetime)) {
		t.Fatalf("login: %v %+v %v", err, u, expires)
	}
	var stored string
	s.DB.QueryRow("SELECT token_hash FROM staff_sessions").Scan(&stored)
	if stored == token {
		t.Error("session token stored in plain text")
	}
	if me, err := s.SessionUser(ctx, token); err != nil || me.Email != "desk@example.com" {
		t.Fatalf("session: %v", err)
	}

	// expiry
	s.Now = func() time.Time { return testNow.Add(SessionLifetime + time.Minute) }
	if _, err := s.SessionUser(ctx, token); !isErr[*AuthError](err) {
		t.Errorf("expired session accepted: %v", err)
	}
	s.Now = func() time.Time { return testNow }

	// disabling signs out; a new password signs out
	if err := s.SetStaffActive(ctx, "desk@example.com", false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SessionUser(ctx, token); !isErr[*AuthError](err) {
		t.Error("disabled account still signed in")
	}
	if _, _, _, err := s.Login(ctx, "desk@example.com", "correct horse battery"); !isErr[*AuthError](err) {
		t.Error("disabled account can sign in")
	}
	s.SetStaffActive(ctx, "desk@example.com", true)
	token, _, _, _ = s.Login(ctx, "desk@example.com", "correct horse battery")
	if err := s.SetStaffPassword(ctx, "desk@example.com", "a brand new password"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SessionUser(ctx, token); !isErr[*AuthError](err) {
		t.Error("old session survived a password change")
	}
	token, _, _, _ = s.Login(ctx, "desk@example.com", "a brand new password")
	s.Logout(ctx, token)
	if _, err := s.SessionUser(ctx, token); !isErr[*AuthError](err) {
		t.Error("session survived logout")
	}
}

func bookingByRef(t *testing.T, s *Store, ref string) *Booking {
	t.Helper()
	list, err := s.StaffBookings(ctx, "all", ref)
	if err != nil || len(list) != 1 {
		t.Fatalf("find %s: %v (%d)", ref, err, len(list))
	}
	return &list[0]
}

func TestStaffListsAndSearch(t *testing.T) {
	s := open(t)
	b := book(t, s, RoomRequest{"standard-twin", 2}, RoomRequest{"standard-twin", 1})
	list, err := s.StaffBookings(ctx, "upcoming", "")
	if err != nil || len(list) != 1 {
		t.Fatalf("upcoming: %v %d", err, len(list))
	}
	got := list[0]
	if got.GuestEmail != contact.Email || got.Guests != 3 || got.Nights != 2 || len(got.Stays) != 2 || got.Stays[0].RoomNumber != 202 {
		t.Errorf("booking %+v", got)
	}
	for _, q := range []string{"tenzin", "EXAMPLE.IN", b.Reference, "204", "90000"} {
		if l, _ := s.StaffBookings(ctx, "all", q); len(l) != 1 {
			t.Errorf("search %q found %d", q, len(l))
		}
	}
	if l, _ := s.StaffBookings(ctx, "all", "%"); len(l) != 0 {
		t.Error("% should be matched literally")
	}
	if _, err := s.StaffBookings(ctx, "bogus", ""); !isErr[*ValidationError](err) {
		t.Error("unknown view accepted")
	}
}

func TestStatusFlow(t *testing.T) {
	s := open(t)
	staff := admin(t, s)
	b := book(t, s, RoomRequest{"luxury-suite", 2})

	if _, err := s.SetBookingStatus(ctx, staff, b.BookingID, "checked_out"); !isErr[*ValidationError](err) {
		t.Errorf("pending → checked out allowed: %v", err)
	}
	if _, err := s.SetBookingStatus(ctx, staff, b.BookingID, "confirmed"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetBookingStatus(ctx, staff, b.BookingID, "checked_in"); !isErr[*ValidationError](err) {
		t.Errorf("check-in a month early allowed: %v", err)
	}
	got, err := s.SetBookingStatus(ctx, staff, b.BookingID, "cancelled")
	if err != nil || got.Status != "cancelled" {
		t.Fatalf("cancel: %v", err)
	}
	if n := free(t, s, "luxury-suite", "2030-02-01", "2030-02-03"); n != 1 {
		t.Error("cancelled booking still holds the suite")
	}

	// someone else takes the suite: reinstating must fail and change nothing
	other := book(t, s, RoomRequest{"luxury-suite", 1})
	if _, err := s.SetBookingStatus(ctx, staff, b.BookingID, "confirmed"); !isErr[*UnavailableError](err) {
		t.Errorf("reinstate over another booking: %v", err)
	}
	s.SetBookingStatus(ctx, staff, other.BookingID, "cancelled")
	got, err = s.SetBookingStatus(ctx, staff, b.BookingID, "confirmed")
	if err != nil || got.Status != "confirmed" || got.Stays[0].Status != "active" {
		t.Fatalf("reinstate: %v %+v", err, got)
	}

	_, history, _ := s.StaffBooking(ctx, b.BookingID)
	if len(history) != 3 || history[0].Staff != "Front Desk" || history[0].Action != "booking.status_changed" {
		t.Errorf("history %+v", history)
	}
}

func TestMoveStay(t *testing.T) {
	s := open(t)
	staff := admin(t, s)
	b := book(t, s, RoomRequest{"standard-twin", 2})
	got := bookingByRef(t, s, b.Reference)
	stay := got.Stays[0].ID // room 202

	opts, err := s.MoveOptions(ctx, got.ID, stay)
	if err != nil || len(opts) != 12 {
		t.Fatalf("options: %v %d", err, len(opts))
	}
	for _, o := range opts {
		if o.RoomNumber == 202 && (o.Free || !o.Current) {
			t.Errorf("current room offered: %+v", o)
		}
	}

	// keep the booked price
	moved, err := s.MoveStay(ctx, staff, got.ID, stay, 205, false)
	if err != nil {
		t.Fatal(err)
	}
	if moved.Stays[0].RoomNumber != 205 || moved.Stays[0].NightlyRatePaise != 250000 || moved.TotalPaise != got.TotalPaise {
		t.Errorf("after move %+v", moved.Stays[0])
	}
	// the suite is now taken, the twin is free again
	if free(t, s, "luxury-suite", "2030-02-01", "2030-02-03") != 0 || free(t, s, "standard-twin", "2030-02-01", "2030-02-03") != 4 {
		t.Error("availability did not follow the move")
	}

	// charge the new room's rate
	moved, err = s.MoveStay(ctx, staff, got.ID, stay, 201, true)
	if err != nil || moved.Stays[0].NightlyRatePaise != 400000 || moved.TotalPaise != 2*400000 {
		t.Fatalf("reprice: %v %+v total %d", err, moved.Stays[0], moved.TotalPaise)
	}

	// a room someone else has is refused
	other := book(t, s, RoomRequest{"standard-king", 2})
	otherRoom := other.Rooms[0].RoomNumber
	if _, err := s.MoveStay(ctx, staff, got.ID, stay, otherRoom, false); !isErr[*UnavailableError](err) {
		t.Errorf("moved onto another booking: %v", err)
	}
	if _, err := s.MoveStay(ctx, staff, got.ID, stay, 999, false); !isErr[*ValidationError](err) {
		t.Errorf("unknown room: %v", err)
	}
	_, history, _ := s.StaffBooking(ctx, got.ID)
	if len(history) != 2 || history[0].Action != "booking.room_switched" {
		t.Errorf("history %+v", history)
	}
}

func TestOutOfServiceLeavesTheBookingForm(t *testing.T) {
	s := open(t)
	staff := admin(t, s)
	if _, err := s.SetRoomStatus(ctx, staff, 205, "out_of_service", "Leaking shower"); err != nil {
		t.Fatal(err)
	}
	if n := free(t, s, "luxury-suite", "2030-02-01", "2030-02-03"); n != 0 {
		t.Errorf("out-of-service suite still offered: %d", n)
	}
	_, err := s.CreateBooking(ctx, BookingRequest{StayDates: StayDates{"2030-02-01", "2030-02-03"}, Contact: contact,
		Rooms: []RoomRequest{{"luxury-suite", 1}}})
	if !isErr[*UnavailableError](err) {
		t.Errorf("booked an out-of-service room: %v", err)
	}
	rooms, _ := s.Rooms(ctx)
	if rooms[4].Number != 205 || rooms[4].Status != "out_of_service" || rooms[4].Note != "Leaking shower" {
		t.Errorf("room 205: %+v", rooms[4])
	}
	if _, err := s.SetRoomStatus(ctx, staff, 205, "active", ""); err != nil {
		t.Fatal(err)
	}
	if n := free(t, s, "luxury-suite", "2030-02-01", "2030-02-03"); n != 1 {
		t.Error("suite not back after making it available")
	}

	// a room with a future guest cannot be closed until they move
	b := book(t, s, RoomRequest{"luxury-suite", 2})
	_, err = s.SetRoomStatus(ctx, staff, 205, "out_of_service", "")
	var busy *RoomBusyError
	if !errors.As(err, &busy) || len(busy.Bookings) != 1 || busy.Bookings[0].Reference != b.Reference {
		t.Fatalf("busy room: %v", err)
	}
	got := bookingByRef(t, s, b.Reference)
	if _, err := s.MoveStay(ctx, staff, got.ID, got.Stays[0].ID, 201, false); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SetRoomStatus(ctx, staff, 205, "out_of_service", "Repainting"); err != nil {
		t.Errorf("after moving the guest: %v", err)
	}
	// and nobody can be moved into it
	if _, err := s.MoveStay(ctx, staff, got.ID, got.Stays[0].ID, 205, false); !isErr[*UnavailableError](err) {
		t.Errorf("moved into an out-of-service room: %v", err)
	}
}

func TestDemoSeed(t *testing.T) {
	s, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	staff := admin(t, s)
	n, err := s.SeedDemo(ctx, staff)
	if err != nil || n != 6 {
		t.Fatalf("seed: %d %v", n, err)
	}
	c, err := s.Today(ctx)
	if err != nil || c.Arrivals != 1 || c.Departures != 1 || c.InHouse != 2 || c.AwaitingPay != 1 {
		t.Errorf("today %+v %v", c, err)
	}
	if _, err := s.SeedDemo(ctx, staff); !isErr[*ValidationError](err) {
		t.Error("seeded twice")
	}
}
