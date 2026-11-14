package store

import (
	"os"
	"path/filepath"
	"testing"
)

func ptr[T any](v T) *T { return &v }

func TestReopeningKeepsData(t *testing.T) {
	file := filepath.Join(t.TempDir(), "hotel.db")
	s, err := Open(file)
	if err != nil {
		t.Fatal(err)
	}
	id := admin(t, s)
	if err := s.UpdateRoomTypePrice(ctx, id, "luxury-suite", 777000); err != nil {
		t.Fatal(err)
	}
	s.Close()

	s, err = Open(file) // second start of the server
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	var rooms, price, fk, version int
	s.DB.QueryRow("SELECT COUNT(*) FROM rooms").Scan(&rooms)
	s.DB.QueryRow("SELECT price_per_night_paise FROM room_types WHERE slug = 'luxury-suite'").Scan(&price)
	s.DB.QueryRow("PRAGMA foreign_keys").Scan(&fk)
	s.DB.QueryRow("PRAGMA user_version").Scan(&version)
	if rooms != 12 || price != 777000 || fk != 1 || version != 1 {
		t.Errorf("rooms %d price %d fk %d version %d", rooms, price, fk, version)
	}
	if _, err := os.Stat(file); err != nil {
		t.Fatal(err)
	}
}

func TestSettingsEdit(t *testing.T) {
	s := open(t)
	id := admin(t, s)
	p, err := s.UpdateSettings(ctx, id, SettingsPatch{CancellationWindowHours: ptr(24), LateCancellationNights: ptr(2)})
	if err != nil || p.CancellationWindowHours != 24 || p.LateCancellationNights != 2 {
		t.Fatalf("%v %+v", err, p)
	}
	var action, details string
	s.DB.QueryRow("SELECT action, details FROM audit_log").Scan(&action, &details)
	if action != "settings.updated" || details != `{"cancellationWindowHours":{"from":48,"to":24},"lateCancellationNights":{"from":1,"to":2}}` {
		t.Errorf("audit %s %s", action, details)
	}
}

func TestInvalidSettingsChangeNothing(t *testing.T) {
	s := open(t)
	id := admin(t, s)
	for _, p := range []SettingsPatch{
		{CheckOutTime: ptr("15:00")}, // later than check-in
		{CheckInTime: ptr("2pm")},
		{CancellationWindowHours: ptr(72), CheckOutTime: ptr("15:00")}, // the valid half rolls back too
	} {
		if _, err := s.UpdateSettings(ctx, id, p); !isErr[*ValidationError](err) {
			t.Errorf("%+v: %v", p, err)
		}
	}
	pol, _ := s.Policy(ctx)
	var n int
	s.DB.QueryRow("SELECT COUNT(*) FROM audit_log").Scan(&n)
	if pol.CheckOutTime != "12:00" || pol.CancellationWindowHours != 48 || n != 0 {
		t.Errorf("%+v, %d audit rows", pol, n)
	}
}

func TestOnlyActiveAdminsEditPricesAndSettings(t *testing.T) {
	s := open(t)
	staff, _ := s.CreateStaff(ctx, "s@example.com", "S", "a long password", "staff")
	if _, err := s.UpdateSettings(ctx, staff.ID, SettingsPatch{CancellationWindowHours: ptr(5)}); !isErr[*ForbiddenError](err) {
		t.Errorf("staff edited settings: %v", err)
	}
	if err := s.UpdateRoomTypePrice(ctx, staff.ID, "luxury-suite", 1000); !isErr[*ForbiddenError](err) {
		t.Errorf("staff edited a price: %v", err)
	}
	if err := s.UpdateRoomTypePrice(ctx, 9999, "luxury-suite", 1000); !isErr[*ForbiddenError](err) {
		t.Errorf("unknown user edited a price: %v", err)
	}
	id := admin(t, s)
	s.SetStaffActive(ctx, "desk@example.com", false)
	if err := s.UpdateRoomTypePrice(ctx, id, "luxury-suite", 1000); !isErr[*ForbiddenError](err) {
		t.Errorf("disabled admin edited a price: %v", err)
	}
}

func TestPriceChangeKeepsBookedRates(t *testing.T) {
	s := open(t)
	id := admin(t, s)
	book(t, s, RoomRequest{"standard-twin", 2})
	if err := s.UpdateRoomTypePrice(ctx, id, "standard-twin", 999000); err != nil {
		t.Fatal(err)
	}
	var rate int
	s.DB.QueryRow("SELECT nightly_rate_paise FROM booking_rooms").Scan(&rate)
	if rate != 250000 {
		t.Errorf("booked rate changed to %d", rate)
	}
	if err := s.UpdateRoomTypePrice(ctx, id, "standard-twin", 0); !isErr[*ValidationError](err) {
		t.Errorf("zero price: %v", err)
	}
}
