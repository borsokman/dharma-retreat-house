package api

import (
	"context"
	"fmt"
	"net/http"

	"dharma/backend/internal/store"
)

// JSON field names follow the frontend's types (frontend/src/api/types.ts);
// request bodies use the snake_case the frontend client already sends.

type roomTypeJSON struct {
	Slug          string  `json:"slug"`
	Name          string  `json:"name"`
	MaxGuests     int     `json:"maxGuests"`
	PricePerNight float64 `json:"pricePerNight"`
	Currency      string  `json:"currency"`
}

func (s *Server) listRooms(w http.ResponseWriter, r *http.Request) {
	types, err := s.Store.RoomTypes(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := make([]roomTypeJSON, len(types))
	for i, t := range types {
		out[i] = roomTypeJSON{t.Slug, t.Name, t.MaxGuests, rupees(t.PricePerNightPaise), currency}
	}
	writeJSON(w, http.StatusOK, out)
}

type availabilityJSON struct {
	roomTypeJSON
	RoomsLeft int     `json:"roomsLeft"`
	Nights    int     `json:"nights"`
	StayPrice float64 `json:"stayPrice"`
}

func (s *Server) availability(w http.ResponseWriter, r *http.Request) {
	d := store.StayDates{CheckIn: r.URL.Query().Get("check_in"), CheckOut: r.URL.Query().Get("check_out")}
	types, err := s.Store.SearchAvailability(r.Context(), d)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	nights, _ := store.NightsOf(d, s.Store.Now())
	out := make([]availabilityJSON, len(types))
	for i, t := range types {
		out[i] = availabilityJSON{
			roomTypeJSON: roomTypeJSON{t.Slug, t.Name, t.MaxGuests, rupees(t.PricePerNightPaise), currency},
			RoomsLeft:    t.FreeRooms,
			Nights:       nights,
			StayPrice:    rupees(t.PricePerNightPaise * int64(nights)),
		}
	}
	writeJSON(w, http.StatusOK, out)
}

type stayBody struct {
	CheckIn  string `json:"check_in"`
	CheckOut string `json:"check_out"`
	Rooms    []struct {
		RoomType string `json:"room_type"`
		Guests   int    `json:"guests"`
	} `json:"rooms"`
}

func (b stayBody) dates() store.StayDates {
	return store.StayDates{CheckIn: b.CheckIn, CheckOut: b.CheckOut}
}

func (b stayBody) rooms() []store.RoomRequest {
	out := make([]store.RoomRequest, len(b.Rooms))
	for i, r := range b.Rooms {
		out[i] = store.RoomRequest{RoomTypeSlug: r.RoomType, Guests: r.Guests}
	}
	return out
}

type moneyLine struct {
	Label  string  `json:"label"`
	Amount float64 `json:"amount"`
}

func taxLines(t []store.TaxLine) []moneyLine {
	out := make([]moneyLine, len(t))
	for i, l := range t {
		out[i] = moneyLine{l.Label, rupees(l.AmountPaise)}
	}
	return out
}

func discountLabel(bp int64) string { return fmt.Sprintf("%g%% long-stay discount", float64(bp)/100) }

func (s *Server) quote(w http.ResponseWriter, r *http.Request) {
	var body stayBody
	if !readJSON(w, r, &body) {
		return
	}
	q, err := s.Store.QuoteStay(r.Context(), body.dates(), body.rooms())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	type line struct {
		RoomSlug string  `json:"roomSlug"`
		RoomName string  `json:"roomName"`
		Guests   int     `json:"guests"`
		Amount   float64 `json:"amount"`
	}
	lines := make([]line, len(q.Lines))
	for i, l := range q.Lines {
		lines[i] = line{l.RoomTypeSlug, l.RoomTypeName, l.Guests, rupees(l.AmountPaise)}
	}
	out := map[string]any{
		"nights":       q.Nights,
		"currency":     currency,
		"lines":        lines,
		"subtotal":     rupees(q.SubtotalPaise),
		"taxesAndFees": taxLines(q.TaxBreakdown),
		"totalPrice":   rupees(q.TotalPaise),
	}
	if q.DiscountPaise > 0 {
		out["discount"] = moneyLine{discountLabel(q.DiscountBp), rupees(q.DiscountPaise)}
	}
	writeJSON(w, http.StatusOK, out)
}

// guestBookingJSON is HotelBooking in frontend/src/api/types.ts.
type guestBookingJSON struct {
	Reference            string      `json:"reference"`
	Status               string      `json:"status"`
	Rooms                []guestRoom `json:"rooms"`
	CheckIn              string      `json:"checkIn"`
	CheckOut             string      `json:"checkOut"`
	Guests               int         `json:"guests"`
	TotalPrice           float64     `json:"totalPrice"`
	Currency             string      `json:"currency"`
	TaxesAndFees         []moneyLine `json:"taxesAndFees"`
	CancellationDeadline string      `json:"cancellationDeadline"`
	RefundPolicy         string      `json:"refundPolicy"`
	// Only in the answer to a new booking: the secret for the manage-booking page.
	ManageToken string `json:"manageToken,omitempty"`
}

type guestRoom struct {
	RoomName string `json:"roomName"`
	Guests   int    `json:"guests"`
}

func (s *Server) refundPolicy(ctx context.Context) string {
	p, err := s.Store.Policy(ctx)
	if err != nil {
		return ""
	}
	return fmt.Sprintf("Free cancellation until %d hours before check-in (%s on the arrival day). "+
		"After that, %d night(s) per room is charged.", p.CancellationWindowHours, p.CheckInTime, p.LateCancellationNights)
}

func (s *Server) guestOut(ctx context.Context, b *store.Booking) guestBookingJSON {
	rooms := []guestRoom{}
	for _, st := range b.Stays {
		if st.Status == "active" || b.Status == "cancelled" {
			rooms = append(rooms, guestRoom{st.RoomType, st.Guests})
		}
	}
	total := b.TotalPaise
	if b.Status == "cancelled" {
		total = b.CancellationFeesPaise
	}
	return guestBookingJSON{
		Reference: b.Reference, Status: b.Status, Rooms: rooms,
		CheckIn: b.CheckIn, CheckOut: b.CheckOut, Guests: b.Guests,
		TotalPrice: rupees(total), Currency: currency, TaxesAndFees: taxLines(b.TaxBreakdown),
		CancellationDeadline: b.CancellationDeadline, RefundPolicy: s.refundPolicy(ctx),
	}
}

func (s *Server) createBooking(w http.ResponseWriter, r *http.Request) {
	var body struct {
		stayBody
		Contact struct {
			Name  string `json:"name"`
			Email string `json:"email"`
			Phone string `json:"phone"`
		} `json:"contact"`
		SpecialRequests string `json:"special_requests"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	created, err := s.Store.CreateBooking(r.Context(), store.BookingRequest{
		StayDates:       body.dates(),
		Rooms:           body.rooms(),
		Contact:         store.Contact{Name: body.Contact.Name, Email: body.Contact.Email, Phone: body.Contact.Phone},
		SpecialRequests: body.SpecialRequests,
	})
	if err != nil {
		s.fail(w, r, err)
		return
	}
	b, err := s.Store.GuestBooking(r.Context(), created.Reference, created.ManageToken)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := s.guestOut(r.Context(), b)
	out.ManageToken = created.ManageToken
	writeJSON(w, http.StatusCreated, out)
}

func (s *Server) guestBooking(w http.ResponseWriter, r *http.Request) {
	b, err := s.Store.GuestBooking(r.Context(), r.PathValue("reference"), r.URL.Query().Get("token"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, s.guestOut(r.Context(), b))
}

func (s *Server) guestCancel(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Reference string `json:"reference"`
		Token     string `json:"token"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	b, err := s.Store.GuestCancel(r.Context(), body.Reference, body.Token)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, s.guestOut(r.Context(), b))
}
