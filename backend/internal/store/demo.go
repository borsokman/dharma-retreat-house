package store

import (
	"context"
	"time"
)

// SeedDemo fills an EMPTY database with a few made-up bookings around today, so
// the staff dashboard has something to show while testing: an arrival, guests in
// house, a departure, future bookings and a cancellation. The status changes are
// recorded in the audit log under staffID. Never run it on the real database.
func (s *Store) SeedDemo(ctx context.Context, staffID int64) (int, error) {
	var n int
	if err := s.DB.QueryRowContext(ctx, "SELECT COUNT(*) FROM bookings").Scan(&n); err != nil {
		return 0, err
	}
	if n > 0 {
		return 0, invalid("the database already has bookings: demo data goes only into an empty one")
	}

	realNow := s.Now
	defer func() { s.Now = realNow }()
	now := realNow()
	today := HotelToday(now)
	day := func(offset int) string { return addDays(today, offset) }
	// past arrivals are booked "three days ago", so the past-date check lets them in
	s.Now = func() time.Time { return now.AddDate(0, 0, -4) }

	demo := []struct {
		name, email, phone, requests string
		in, out                      int
		rooms                        []RoomRequest
		status                       []string // status changes after booking, in order
	}{
		{"Tenzin Dorji", "tenzin.dorji@example.com", "+91 94000 11111", "Arriving by shared taxi from Bomdila around 4 pm.",
			0, 3, []RoomRequest{{"luxury-suite", 2}}, []string{"confirmed"}},
		{"Anna Müller", "anna.mueller@example.com", "+49 151 2222 3333", "",
			-2, 2, []RoomRequest{{"super-deluxe-king", 2}, {"standard-twin", 1}}, []string{"confirmed", "checked_in"}},
		{"Rahul Sharma", "rahul.sharma@example.com", "+91 98100 44444", "Vegetarian breakfast, please.",
			-3, 0, []RoomRequest{{"standard-king", 2}}, []string{"confirmed", "checked_in"}},
		{"Sonam Lhamo", "sonam.lhamo@example.com", "+91 94360 55555", "",
			5, 12, []RoomRequest{{"standard-twin", 1}}, nil},
		{"Lukas Weber", "lukas.weber@example.com", "+41 79 666 7777", "Two couples travelling together.",
			10, 14, []RoomRequest{{"super-deluxe-king", 2}, {"super-deluxe-king", 2}}, []string{"confirmed"}},
		{"Mei Chen", "mei.chen@example.com", "+65 8888 9999", "",
			20, 22, []RoomRequest{{"executive-twin", 2}}, []string{"cancelled"}},
	}
	for _, d := range demo {
		created, err := s.CreateBooking(ctx, BookingRequest{
			StayDates:       StayDates{day(d.in), day(d.out)},
			Rooms:           d.rooms,
			Contact:         Contact{d.name, d.email, d.phone},
			SpecialRequests: d.requests,
		})
		if err != nil {
			return n, err
		}
		s.Now = realNow
		for _, st := range d.status {
			if _, err := s.SetBookingStatus(ctx, staffID, created.BookingID, st); err != nil {
				return n, err
			}
		}
		s.Now = func() time.Time { return now.AddDate(0, 0, -4) }
		n++
	}
	return n, nil
}
