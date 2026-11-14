// Package api is the HTTP layer: routes, JSON shapes, staff sessions and the
// protections around them. All booking rules live in internal/store.
package api

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"dharma/backend/internal/store"
)

const sessionCookie = "drh_staff"

type Server struct {
	Store *store.Store
	// SecureCookies marks the staff cookie Secure (HTTPS only). Turn it off only
	// for local development over plain http.
	SecureCookies bool
	// AllowedOrigins may send state-changing requests besides the server's own
	// origin, e.g. "http://localhost:5173" in development.
	AllowedOrigins []string
	Log            *slog.Logger

	limiter *loginLimiter
}

func (s *Server) Handler() http.Handler {
	if s.Log == nil {
		s.Log = slog.Default()
	}
	s.limiter = newLoginLimiter()
	mux := http.NewServeMux()

	mux.HandleFunc("GET /api/v1/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})

	// guests
	mux.HandleFunc("GET /api/v1/rooms", s.listRooms)
	mux.HandleFunc("GET /api/v1/rooms/availability", s.availability)
	mux.HandleFunc("POST /api/v1/bookings/quote", s.quote)
	mux.HandleFunc("POST /api/v1/bookings", s.createBooking)
	mux.HandleFunc("GET /api/v1/bookings/{reference}", s.guestBooking)
	mux.HandleFunc("POST /api/v1/bookings/cancel", s.guestCancel)

	// staff
	mux.HandleFunc("POST /api/v1/staff/login", s.login)
	mux.HandleFunc("POST /api/v1/staff/logout", s.logout)
	mux.Handle("GET /api/v1/staff/me", s.staff(s.me))
	mux.Handle("GET /api/v1/staff/today", s.staff(s.today))
	mux.Handle("GET /api/v1/staff/bookings", s.staff(s.staffBookings))
	mux.Handle("GET /api/v1/staff/bookings/{id}", s.staff(s.staffBooking))
	mux.Handle("PATCH /api/v1/staff/bookings/{id}", s.staff(s.updateBooking))
	mux.Handle("GET /api/v1/staff/bookings/{id}/stays/{stay}/options", s.staff(s.moveOptions))
	mux.Handle("POST /api/v1/staff/bookings/{id}/stays/{stay}/move", s.staff(s.moveStay))
	mux.Handle("GET /api/v1/staff/rooms", s.staff(s.rooms))
	mux.Handle("PATCH /api/v1/staff/rooms/{number}", s.staff(s.setRoomStatus))

	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		writeError(w, http.StatusNotFound, "not found")
	})
	return s.protect(mux)
}

// protect adds the protections every route shares:
//   - state-changing requests must be JSON from an allowed origin. Browsers cannot
//     send JSON across sites without asking first, so together with the SameSite
//     cookie this stops cross-site request forgery against the staff API.
//   - small request bodies, no caching of API answers, no MIME sniffing.
func (s *Server) protect(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := w.Header()
		h.Set("X-Content-Type-Options", "nosniff")
		h.Set("Cache-Control", "no-store")
		h.Set("Referrer-Policy", "no-referrer")
		if r.Method != http.MethodGet && r.Method != http.MethodHead {
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				writeError(w, http.StatusUnsupportedMediaType, "requests must be JSON")
				return
			}
			if !s.originAllowed(r) {
				writeError(w, http.StatusForbidden, "request from an unknown site")
				return
			}
			r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
		}
		start := time.Now()
		next.ServeHTTP(w, r)
		s.Log.Debug("request", "method", r.Method, "path", r.URL.Path, "took", time.Since(start))
	})
}

func (s *Server) originAllowed(r *http.Request) bool {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return true // not a browser, or a same-origin request from an old browser
	}
	u, err := url.Parse(origin)
	if err == nil && u.Host == r.Host {
		return true
	}
	for _, o := range s.AllowedOrigins {
		if strings.EqualFold(o, origin) {
			return true
		}
	}
	return false
}

// ---- JSON helpers ----------------------------------------------------------------

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"message": msg})
}

func readJSON(w http.ResponseWriter, r *http.Request, v any) bool {
	if err := json.NewDecoder(r.Body).Decode(v); err != nil {
		writeError(w, http.StatusBadRequest, "the request body is not valid JSON")
		return false
	}
	return true
}

// fail maps store errors to HTTP answers; anything unexpected is logged and hidden.
func (s *Server) fail(w http.ResponseWriter, r *http.Request, err error) {
	var (
		v    *store.ValidationError
		u    *store.UnavailableError
		n    *store.NotFoundError
		f    *store.ForbiddenError
		a    *store.AuthError
		busy *store.RoomBusyError
	)
	switch {
	case errors.As(err, &v):
		writeError(w, http.StatusBadRequest, v.Msg)
	case errors.As(err, &u):
		writeError(w, http.StatusConflict, u.Msg)
	case errors.As(err, &busy):
		refs := make([]stayRefJSON, len(busy.Bookings))
		for i, b := range busy.Bookings {
			refs[i] = stayRefOut(&b)
		}
		writeJSON(w, http.StatusConflict, map[string]any{"message": busy.Error(), "bookings": refs})
	case errors.As(err, &n):
		writeError(w, http.StatusNotFound, n.Msg)
	case errors.As(err, &f):
		writeError(w, http.StatusForbidden, f.Msg)
	case errors.As(err, &a):
		writeError(w, http.StatusUnauthorized, a.Msg)
	default:
		s.Log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
		writeError(w, http.StatusInternalServerError, "something went wrong on our side: please try again")
	}
}

// rupees: the database counts paise; the website shows rupees.
func rupees(paise int64) float64 { return float64(paise) / 100 }

const currency = "INR"
