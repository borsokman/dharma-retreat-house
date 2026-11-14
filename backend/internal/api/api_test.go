package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"dharma/backend/internal/store"
)

func setup(t *testing.T) (*httptest.Server, *http.Client) {
	t.Helper()
	st, err := store.Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	st.Now = func() time.Time { return time.Date(2030, 1, 1, 6, 0, 0, 0, time.UTC) }
	if _, err := st.CreateStaff(context.Background(), "desk@example.com", "Front Desk", "correct horse battery", "staff"); err != nil {
		t.Fatal(err)
	}
	srv := httptest.NewServer((&Server{Store: st}).Handler())
	t.Cleanup(func() { srv.Close(); st.Close() })
	jar, _ := cookiejar.New(nil)
	return srv, &http.Client{Jar: jar}
}

func call(t *testing.T, c *http.Client, method, url, body string, headers ...string) (int, map[string]any, *http.Response) {
	t.Helper()
	req, _ := http.NewRequest(method, url, strings.NewReader(body))
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	for i := 0; i+1 < len(headers); i += 2 {
		req.Header.Set(headers[i], headers[i+1])
	}
	res, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out map[string]any
	if len(raw) > 0 && raw[0] == '{' {
		json.Unmarshal(raw, &out)
	} else if len(raw) > 0 && raw[0] == '[' {
		var list []any
		json.Unmarshal(raw, &list)
		out = map[string]any{"list": list}
	}
	return res.StatusCode, out, res
}

const login = `{"email":"desk@example.com","password":"correct horse battery"}`

func TestStaffRoutesNeedASession(t *testing.T) {
	srv, c := setup(t)
	for _, path := range []string{"/api/v1/staff/me", "/api/v1/staff/bookings", "/api/v1/staff/rooms", "/api/v1/staff/today"} {
		if code, _, _ := call(t, c, "GET", srv.URL+path, ""); code != http.StatusUnauthorized {
			t.Errorf("%s without session: %d", path, code)
		}
	}
	if code, _, _ := call(t, c, "PATCH", srv.URL+"/api/v1/staff/rooms/205", `{"status":"out_of_service"}`); code != http.StatusUnauthorized {
		t.Errorf("room change without session: %d", code)
	}
}

func TestLoginCookieAndLogout(t *testing.T) {
	srv, c := setup(t)
	code, body, res := call(t, c, "POST", srv.URL+"/api/v1/staff/login", login)
	if code != 200 || body["name"] != "Front Desk" {
		t.Fatalf("login: %d %v", code, body)
	}
	cookie := res.Header.Get("Set-Cookie")
	for _, want := range []string{"drh_staff=", "HttpOnly", "SameSite=Strict", "Path=/api/v1/staff"} {
		if !strings.Contains(cookie, want) {
			t.Errorf("cookie lacks %s: %s", want, cookie)
		}
	}
	if code, body, _ := call(t, c, "GET", srv.URL+"/api/v1/staff/me", ""); code != 200 || body["email"] != "desk@example.com" {
		t.Errorf("me: %d %v", code, body)
	}
	if code, _, _ := call(t, c, "POST", srv.URL+"/api/v1/staff/logout", "{}"); code != http.StatusNoContent {
		t.Errorf("logout: %d", code)
	}
	if code, _, _ := call(t, c, "GET", srv.URL+"/api/v1/staff/me", ""); code != http.StatusUnauthorized {
		t.Errorf("after logout: %d", code)
	}
}

func TestForgeryProtections(t *testing.T) {
	srv, c := setup(t)
	call(t, c, "POST", srv.URL+"/api/v1/staff/login", login)
	// a form post from another site: not JSON
	req, _ := http.NewRequest("PATCH", srv.URL+"/api/v1/staff/rooms/205", strings.NewReader("status=out_of_service"))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	res, _ := c.Do(req)
	res.Body.Close()
	if res.StatusCode != http.StatusUnsupportedMediaType {
		t.Errorf("form post: %d", res.StatusCode)
	}
	// JSON from an unknown origin
	if code, _, _ := call(t, c, "PATCH", srv.URL+"/api/v1/staff/rooms/205", `{"status":"out_of_service"}`,
		"Origin", "https://evil.example"); code != http.StatusForbidden {
		t.Errorf("foreign origin: %d", code)
	}
	// same origin works
	if code, body, _ := call(t, c, "PATCH", srv.URL+"/api/v1/staff/rooms/205", `{"status":"out_of_service","note":"Paint"}`,
		"Origin", srv.URL); code != 200 || body["status"] != "out_of_service" {
		t.Errorf("same origin: %d %v", code, body)
	}
}

func TestLoginThrottling(t *testing.T) {
	srv, c := setup(t)
	bad := `{"email":"desk@example.com","password":"wrong password"}`
	for i := 0; i < limitPerEmail; i++ {
		if code, _, _ := call(t, c, "POST", srv.URL+"/api/v1/staff/login", bad); code != http.StatusUnauthorized {
			t.Fatalf("attempt %d: %d", i, code)
		}
	}
	if code, _, _ := call(t, c, "POST", srv.URL+"/api/v1/staff/login", login); code != http.StatusTooManyRequests {
		t.Errorf("after %d failures even the right password should wait: %d", limitPerEmail, code)
	}
}

func TestGuestBookingReachesTheDashboard(t *testing.T) {
	srv, c := setup(t)
	code, avail, _ := call(t, c, "GET", srv.URL+"/api/v1/rooms/availability?check_in=2030-02-01&check_out=2030-02-04", "")
	if code != 200 || len(avail["list"].([]any)) != 5 {
		t.Fatalf("availability: %d %v", code, avail)
	}
	first := avail["list"].([]any)[0].(map[string]any)
	if first["slug"] != "luxury-suite" || first["roomsLeft"] != 1.0 || first["stayPrice"] != 15000.0 || first["currency"] != "INR" {
		t.Errorf("suite: %v", first)
	}

	stay := `"check_in":"2030-02-01","check_out":"2030-02-04","rooms":[{"room_type":"standard-twin","guests":2},{"room_type":"standard-twin","guests":1}]`
	code, q, _ := call(t, c, "POST", srv.URL+"/api/v1/bookings/quote", "{"+stay+"}")
	if code != 200 || q["totalPrice"] != 15000.0 || q["nights"] != 3.0 {
		t.Fatalf("quote: %d %v", code, q)
	}
	code, b, _ := call(t, c, "POST", srv.URL+"/api/v1/bookings",
		`{`+stay+`,"contact":{"name":"Pema","email":"pema@example.com","phone":"+91 9"},"special_requests":"Late arrival"}`)
	if code != http.StatusCreated || b["manageToken"] == nil || len(b["rooms"].([]any)) != 2 || b["guests"] != 3.0 {
		t.Fatalf("booking: %d %v", code, b)
	}
	ref, token := b["reference"].(string), b["manageToken"].(string)
	if code, g, _ := call(t, c, "GET", srv.URL+"/api/v1/bookings/"+ref+"?token="+token, ""); code != 200 || g["manageToken"] != nil {
		t.Errorf("guest lookup: %d %v", code, g)
	}
	if code, _, _ := call(t, c, "GET", srv.URL+"/api/v1/bookings/"+ref+"?token=nope", ""); code != 404 {
		t.Errorf("wrong token: %d", code)
	}

	call(t, c, "POST", srv.URL+"/api/v1/staff/login", login)
	code, list, _ := call(t, c, "GET", srv.URL+"/api/v1/staff/bookings?view=upcoming&q=pema", "")
	if code != 200 || len(list["list"].([]any)) != 1 {
		t.Fatalf("staff list: %d %v", code, list)
	}
	got := list["list"].([]any)[0].(map[string]any)
	stays := got["stays"].([]any)
	if got["guestEmail"] != "pema@example.com" || got["specialRequests"] != "Late arrival" || len(stays) != 2 ||
		stays[0].(map[string]any)["roomNumber"] != 202.0 {
		t.Errorf("staff booking: %v", got)
	}

	id := int(got["id"].(float64))
	stayID := int(stays[0].(map[string]any)["id"].(float64))
	base := srv.URL + "/api/v1/staff/bookings/" + strconv.Itoa(id)
	if code, opts, _ := call(t, c, "GET", base+"/stays/"+strconv.Itoa(stayID)+"/options", ""); code != 200 || len(opts["list"].([]any)) != 12 {
		t.Errorf("options: %d", code)
	}
	code, moved, _ := call(t, c, "POST", base+"/stays/"+strconv.Itoa(stayID)+"/move", `{"roomNumber":209}`)
	if code != 200 {
		t.Fatalf("move: %d %v", code, moved)
	}
	for _, st := range moved["stays"].([]any) {
		if m := st.(map[string]any); int(m["id"].(float64)) == stayID && m["roomNumber"] != 209.0 {
			t.Errorf("stay not in 209: %v", m)
		}
	}
	code, upd, _ := call(t, c, "PATCH", base, `{"status":"confirmed","staffNotes":"Paid by bank transfer"}`)
	if code != 200 || upd["status"] != "confirmed" || upd["staffNotes"] != "Paid by bank transfer" {
		t.Errorf("update: %d %v", code, upd)
	}
	code, detail, _ := call(t, c, "GET", base, "")
	if code != 200 || len(detail["history"].([]any)) != 3 {
		t.Errorf("detail: %d %v", code, detail["history"])
	}
	// the room the booking now holds cannot be closed
	code, busy, _ := call(t, c, "PATCH", srv.URL+"/api/v1/staff/rooms/209", `{"status":"out_of_service"}`)
	if code != http.StatusConflict || len(busy["bookings"].([]any)) != 1 {
		t.Errorf("busy room: %d %v", code, busy)
	}
}
