package store

import (
	"context"
	"database/sql"
)

// Policy is the part of the settings row guests see.
type Policy struct {
	CheckInTime             string
	CheckOutTime            string
	CancellationWindowHours int
	LateCancellationNights  int
}

func (s *Store) Policy(ctx context.Context) (*Policy, error) { return policyOf(ctx, s.DB) }

// ---- admin edits: settings and prices ---------------------------------------------

// assertAdmin: prices, discounts, taxes and settings may only be changed by an active admin.
func assertAdmin(ctx context.Context, q queryer, staffID int64) error {
	var role string
	var active bool
	err := q.QueryRowContext(ctx, "SELECT role, is_active FROM staff_users WHERE id = ?", staffID).Scan(&role, &active)
	if err == sql.ErrNoRows || (err == nil && (!active || role != "admin")) {
		return &ForbiddenError{"only an active admin can change this"}
	}
	return err
}

// SettingsPatch: nil fields stay as they are.
type SettingsPatch struct {
	CheckInTime             *string
	CheckOutTime            *string
	CancellationWindowHours *int
	LateCancellationNights  *int
}

// UpdateSettings is one UPDATE on the single settings row plus one audit row. The
// table's CHECK constraints (e.g. check-out must be earlier than check-in) reject
// bad values, and the transaction then leaves everything unchanged.
func (s *Store) UpdateSettings(ctx context.Context, staffID int64, p SettingsPatch) (*Policy, error) {
	var out *Policy
	err := s.tx(ctx, func(tx *sql.Tx) error {
		if err := assertAdmin(ctx, tx, staffID); err != nil {
			return err
		}
		before, err := policyOf(ctx, tx)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `
			UPDATE settings SET check_in_time = COALESCE(?, check_in_time), check_out_time = COALESCE(?, check_out_time),
			  cancellation_window_hours = COALESCE(?, cancellation_window_hours),
			  late_cancellation_nights = COALESCE(?, late_cancellation_nights)
			WHERE id = 1`, p.CheckInTime, p.CheckOutTime, p.CancellationWindowHours, p.LateCancellationNights); err != nil {
			return err
		}
		if out, err = policyOf(ctx, tx); err != nil {
			return err
		}
		changed := map[string]map[string]any{}
		add := func(key string, from, to any) {
			if from != to {
				changed[key] = map[string]any{"from": from, "to": to}
			}
		}
		add("checkInTime", before.CheckInTime, out.CheckInTime)
		add("checkOutTime", before.CheckOutTime, out.CheckOutTime)
		add("cancellationWindowHours", before.CancellationWindowHours, out.CancellationWindowHours)
		add("lateCancellationNights", before.LateCancellationNights, out.LateCancellationNights)
		if len(changed) == 0 {
			return nil
		}
		return audit(ctx, tx, &staffID, "settings.updated", "settings", 1, detailsJSON(changed))
	})
	return out, fromTrigger(err)
}

func policyOf(ctx context.Context, q queryer) (*Policy, error) {
	var p Policy
	err := q.QueryRowContext(ctx, `
		SELECT check_in_time, check_out_time, cancellation_window_hours, late_cancellation_nights
		FROM settings WHERE id = 1`).Scan(&p.CheckInTime, &p.CheckOutTime, &p.CancellationWindowHours, &p.LateCancellationNights)
	return &p, err
}

// UpdateRoomTypePrice changes a room type's nightly price (paise). Existing bookings
// are NOT touched: each stay keeps the nightly rate it was booked at.
func (s *Store) UpdateRoomTypePrice(ctx context.Context, staffID int64, slug string, paise int64) error {
	if paise <= 0 {
		return invalid("the price must be a positive whole number of paise")
	}
	return s.tx(ctx, func(tx *sql.Tx) error {
		if err := assertAdmin(ctx, tx, staffID); err != nil {
			return err
		}
		var id, before int64
		err := tx.QueryRowContext(ctx, "SELECT id, price_per_night_paise FROM room_types WHERE slug = ?", slug).Scan(&id, &before)
		if err == sql.ErrNoRows {
			return &NotFoundError{"room type " + slug + " not found"}
		}
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE room_types SET price_per_night_paise = ? WHERE id = ?", paise, id); err != nil {
			return err
		}
		return audit(ctx, tx, &staffID, "room_type.price_changed", "room_type", id,
			detailsJSON(map[string]int64{"from": before, "to": paise}))
	})
}
