package api

import (
	"context"
	"encoding/json"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"dharma/backend/internal/store"
)

// ---- sessions ------------------------------------------------------------------------

type ctxKey struct{}

func staffFrom(ctx context.Context) *store.StaffUser { return ctx.Value(ctxKey{}).(*store.StaffUser) }

// staff wraps a handler that needs a signed-in staff member. The session lives in an
// HttpOnly cookie, so page scripts can never read it.
func (s *Server) staff(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, _ := r.Cookie(sessionCookie)
		token := ""
		if c != nil {
			token = c.Value
		}
		u, err := s.Store.SessionUser(r.Context(), token)
		if err != nil {
			if c != nil {
				s.clearCookie(w)
			}
			s.fail(w, r, err)
			return
		}
		h(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, u)))
	})
}

func (s *Server) setCookie(w http.ResponseWriter, token string, expires time.Time) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: token, Path: "/api/v1/staff",
		Expires: expires, MaxAge: int(time.Until(expires).Seconds()),
		HttpOnly: true, Secure: s.SecureCookies, SameSite: http.SameSiteStrictMode,
	})
}

func (s *Server) clearCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/api/v1/staff", MaxAge: -1,
		HttpOnly: true, Secure: s.SecureCookies, SameSite: http.SameSiteStrictMode,
	})
}

type staffUserJSON struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	Role  string `json:"role"`
}

func staffOut(u *store.StaffUser) staffUserJSON { return staffUserJSON{u.Email, u.Name, u.Role} }

// ---- login throttling ----------------------------------------------------------------

// loginLimiter slows down password guessing: after 5 wrong passwords for one
// email from one address, or 20 from one address, sign-in from there pauses for
// 15 minutes. It lives in memory, which is enough for one server.
type loginLimiter struct {
	mu       sync.Mutex
	failures map[string][]time.Time
}

const (
	limitWindow   = 15 * time.Minute
	limitPerEmail = 5
	limitPerIP    = 20
)

func newLoginLimiter() *loginLimiter { return &loginLimiter{failures: map[string][]time.Time{}} }

func (l *loginLimiter) recent(key string, now time.Time) []time.Time {
	kept := l.failures[key][:0]
	for _, t := range l.failures[key] {
		if now.Sub(t) < limitWindow {
			kept = append(kept, t)
		}
	}
	if len(kept) == 0 {
		delete(l.failures, key)
		return nil
	}
	l.failures[key] = kept
	return kept
}

func (l *loginLimiter) blocked(ip, email string, now time.Time) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.recent("ip:"+ip, now)) >= limitPerIP || len(l.recent("em:"+ip+"|"+email, now)) >= limitPerEmail
}

func (l *loginLimiter) fail(ip, email string, now time.Time) {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.failures["ip:"+ip] = append(l.failures["ip:"+ip], now)
	l.failures["em:"+ip+"|"+email] = append(l.failures["em:"+ip+"|"+email], now)
}

func (l *loginLimiter) reset(ip, email string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.failures, "em:"+ip+"|"+email)
}

func clientIP(r *http.Request) string {
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}

// ---- handlers ---------------------------------------------------------------------------

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	ip, email, now := clientIP(r), strings.ToLower(strings.TrimSpace(body.Email)), time.Now()
	if s.limiter.blocked(ip, email, now) {
		writeError(w, http.StatusTooManyRequests, "too many wrong attempts: please wait 15 minutes and try again")
		return
	}
	token, u, expires, err := s.Store.Login(r.Context(), email, body.Password)
	if err != nil {
		if _, ok := err.(*store.AuthError); ok {
			s.limiter.fail(ip, email, now)
		}
		s.fail(w, r, err)
		return
	}
	s.limiter.reset(ip, email)
	s.setCookie(w, token, expires)
	writeJSON(w, http.StatusOK, staffOut(u))
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookie); err == nil {
		if err := s.Store.Logout(r.Context(), c.Value); err != nil {
			s.fail(w, r, err)
			return
		}
	}
	s.clearCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, staffOut(staffFrom(r.Context())))
}

func (s *Server) today(w http.ResponseWriter, r *http.Request) {
	c, err := s.Store.Today(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"date": c.Date, "arrivals": c.Arrivals, "departures": c.Departures, "inHouse": c.InHouse,
		"roomsFree": c.RoomsFree, "outOfService": c.OutOfOrder, "awaitingPayment": c.AwaitingPay,
	})
}

// ---- bookings ---------------------------------------------------------------------------

type stayJSON struct {
	ID              int64   `json:"id"`
	RoomNumber      int     `json:"roomNumber"`
	RoomType        string  `json:"roomType"`
	RoomSlug        string  `json:"roomSlug"`
	CheckIn         string  `json:"checkIn"`
	CheckOut        string  `json:"checkOut"`
	Guests          int     `json:"guests"`
	NightlyRate     float64 `json:"nightlyRate"`
	Status          string  `json:"status"`
	CancellationFee float64 `json:"cancellationFee"`
}

type staffBookingJSON struct {
	ID                   int64       `json:"id"`
	Reference            string      `json:"reference"`
	Status               string      `json:"status"`
	NextStatuses         []string    `json:"nextStatuses"`
	Source               string      `json:"source"`
	GuestName            string      `json:"guestName"`
	GuestEmail           string      `json:"guestEmail"`
	GuestPhone           string      `json:"guestPhone"`
	SpecialRequests      string      `json:"specialRequests"`
	StaffNotes           string      `json:"staffNotes"`
	CheckIn              string      `json:"checkIn"`
	CheckOut             string      `json:"checkOut"`
	Nights               int         `json:"nights"`
	Guests               int         `json:"guests"`
	Stays                []stayJSON  `json:"stays"`
	Subtotal             float64     `json:"subtotal"`
	Discount             float64     `json:"discount"`
	DiscountLabel        string      `json:"discountLabel,omitempty"`
	TaxesAndFees         []moneyLine `json:"taxesAndFees"`
	Total                float64     `json:"total"`
	CancellationFees     float64     `json:"cancellationFees"`
	AmountDue            float64     `json:"amountDue"`
	Paid                 float64     `json:"paid"`
	Balance              float64     `json:"balance"`
	Currency             string      `json:"currency"`
	CancellationDeadline string      `json:"cancellationDeadline"`
	CreatedAt            string      `json:"createdAt"`
}

func bookingOut(b *store.Booking) staffBookingJSON {
	stays := make([]stayJSON, len(b.Stays))
	for i, st := range b.Stays {
		stays[i] = stayJSON{st.ID, st.RoomNumber, st.RoomType, st.RoomTypeSlug, st.CheckIn, st.CheckOut,
			st.Guests, rupees(st.NightlyRatePaise), st.Status, rupees(st.CancellationFeePaise)}
	}
	out := staffBookingJSON{
		ID: b.ID, Reference: b.Reference, Status: b.Status, NextStatuses: store.AllowedStatuses(b.Status),
		Source: b.Source, GuestName: b.GuestName, GuestEmail: b.GuestEmail, GuestPhone: b.GuestPhone,
		SpecialRequests: b.SpecialRequests, StaffNotes: b.StaffNotes,
		CheckIn: b.CheckIn, CheckOut: b.CheckOut, Nights: b.Nights, Guests: b.Guests, Stays: stays,
		Subtotal: rupees(b.SubtotalPaise), Discount: rupees(b.DiscountPaise),
		TaxesAndFees: taxLines(b.TaxBreakdown), Total: rupees(b.TotalPaise),
		CancellationFees: rupees(b.CancellationFeesPaise), AmountDue: rupees(b.AmountDuePaise),
		Paid: rupees(b.PaidPaise), Balance: rupees(b.BalancePaise), Currency: currency,
		CancellationDeadline: b.CancellationDeadline, CreatedAt: b.CreatedAt,
	}
	if b.DiscountPaise > 0 {
		out.DiscountLabel = discountLabel(b.DiscountBp)
	}
	return out
}

func (s *Server) staffBookings(w http.ResponseWriter, r *http.Request) {
	view := r.URL.Query().Get("view")
	if view == "" {
		view = "upcoming"
	}
	list, err := s.Store.StaffBookings(r.Context(), view, r.URL.Query().Get("q"))
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := make([]staffBookingJSON, len(list))
	for i := range list {
		out[i] = bookingOut(&list[i])
	}
	writeJSON(w, http.StatusOK, out)
}

func pathID(w http.ResponseWriter, r *http.Request, name string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusNotFound, "not found")
		return 0, false
	}
	return id, true
}

func (s *Server) staffBooking(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	b, history, err := s.Store.StaffBooking(r.Context(), id)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	type entry struct {
		At      string          `json:"at"`
		Staff   string          `json:"staff"`
		Action  string          `json:"action"`
		Details json.RawMessage `json:"details"`
	}
	h := make([]entry, len(history))
	for i, e := range history {
		h[i] = entry{e.At, e.Staff, e.Action, json.RawMessage(e.Details)}
	}
	writeJSON(w, http.StatusOK, map[string]any{"booking": bookingOut(b), "history": h})
}

// updateBooking changes the status and/or the staff notes.
func (s *Server) updateBooking(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r, "id")
	if !ok {
		return
	}
	var body struct {
		Status     *string `json:"status"`
		StaffNotes *string `json:"staffNotes"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	u := staffFrom(r.Context())
	var b *store.Booking
	var err error
	if body.StaffNotes != nil {
		if b, err = s.Store.SetStaffNotes(r.Context(), u.ID, id, *body.StaffNotes); err != nil {
			s.fail(w, r, err)
			return
		}
	}
	if body.Status != nil {
		if b, err = s.Store.SetBookingStatus(r.Context(), u.ID, id, *body.Status); err != nil {
			s.fail(w, r, err)
			return
		}
	}
	if b == nil {
		writeError(w, http.StatusBadRequest, "nothing to change")
		return
	}
	writeJSON(w, http.StatusOK, bookingOut(b))
}

func (s *Server) moveOptions(w http.ResponseWriter, r *http.Request) {
	id, ok1 := pathID(w, r, "id")
	if !ok1 {
		return
	}
	stay, ok2 := pathID(w, r, "stay")
	if !ok2 {
		return
	}
	opts, err := s.Store.MoveOptions(r.Context(), id, stay)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	type opt struct {
		RoomNumber    int     `json:"roomNumber"`
		RoomType      string  `json:"roomType"`
		PricePerNight float64 `json:"pricePerNight"`
		MaxGuests     int     `json:"maxGuests"`
		Status        string  `json:"status"`
		Note          string  `json:"note"`
		Current       bool    `json:"current"`
		Free          bool    `json:"free"`
		Reason        string  `json:"reason"`
	}
	out := make([]opt, len(opts))
	for i, o := range opts {
		out[i] = opt{o.RoomNumber, o.RoomType, rupees(o.PricePerNightPaise), o.MaxGuests, o.Status, o.Note, o.Current, o.Free, o.Reason}
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) moveStay(w http.ResponseWriter, r *http.Request) {
	id, ok1 := pathID(w, r, "id")
	if !ok1 {
		return
	}
	stay, ok2 := pathID(w, r, "stay")
	if !ok2 {
		return
	}
	var body struct {
		RoomNumber int  `json:"roomNumber"`
		Reprice    bool `json:"reprice"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	b, err := s.Store.MoveStay(r.Context(), staffFrom(r.Context()).ID, id, stay, body.RoomNumber, body.Reprice)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, bookingOut(b))
}

// ---- rooms ---------------------------------------------------------------------------------

type stayRefJSON struct {
	BookingID int64  `json:"bookingId"`
	Reference string `json:"reference"`
	GuestName string `json:"guestName"`
	CheckIn   string `json:"checkIn"`
	CheckOut  string `json:"checkOut"`
	Status    string `json:"status"`
}

func stayRefOut(r *store.StayRef) stayRefJSON {
	return stayRefJSON{r.BookingID, r.Reference, r.GuestName, r.CheckIn, r.CheckOut, r.Status}
}

type roomJSON struct {
	Number    int          `json:"number"`
	RoomType  string       `json:"roomType"`
	RoomSlug  string       `json:"roomSlug"`
	MaxGuests int          `json:"maxGuests"`
	Status    string       `json:"status"`
	Note      string       `json:"note"`
	Tonight   *stayRefJSON `json:"tonight"`
	Next      *stayRefJSON `json:"next"`
}

func roomOut(r *store.RoomStatus) roomJSON {
	out := roomJSON{Number: r.Number, RoomType: r.RoomType, RoomSlug: r.TypeSlug, MaxGuests: r.MaxGuests, Status: r.Status, Note: r.Note}
	if r.Tonight != nil {
		v := stayRefOut(r.Tonight)
		out.Tonight = &v
	}
	if r.Next != nil {
		v := stayRefOut(r.Next)
		out.Next = &v
	}
	return out
}

func (s *Server) rooms(w http.ResponseWriter, r *http.Request) {
	rooms, err := s.Store.Rooms(r.Context())
	if err != nil {
		s.fail(w, r, err)
		return
	}
	out := make([]roomJSON, len(rooms))
	for i := range rooms {
		out[i] = roomOut(&rooms[i])
	}
	writeJSON(w, http.StatusOK, out)
}

func (s *Server) setRoomStatus(w http.ResponseWriter, r *http.Request) {
	number, err := strconv.Atoi(r.PathValue("number"))
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	var body struct {
		Status string `json:"status"`
		Note   string `json:"note"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	room, err := s.Store.SetRoomStatus(r.Context(), staffFrom(r.Context()).ID, number, body.Status, body.Note)
	if err != nil {
		s.fail(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, roomOut(room))
}
