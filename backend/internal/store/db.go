// Package store holds every rule about rooms, bookings and staff. It talks to
// SQLite only; the HTTP layer (internal/api) turns its errors into status codes.
package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io/fs"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"

	"dharma/backend/migrations"

	_ "modernc.org/sqlite"
)

// Store is the booking database. Now is the clock (tests replace it).
type Store struct {
	DB  *sql.DB
	Now func() time.Time
}

// Open opens the database file (created if missing) and brings its STRUCTURE up
// to date. It never recreates or empties anything: migrations that already ran
// are skipped. Use ":memory:" for a throwaway database.
func Open(path string) (*Store, error) {
	q := url.Values{}
	// IMMEDIATE: every transaction takes the write lock before it reads, so two
	// guests racing for the last room cannot both pass the availability check.
	q.Set("_txlock", "immediate")
	q.Add("_pragma", "foreign_keys(1)") // per connection: SQLite forgets it otherwise
	q.Add("_pragma", "busy_timeout(5000)")
	if path != ":memory:" {
		q.Add("_pragma", "journal_mode(WAL)")
	}
	db, err := sql.Open("sqlite", "file:"+path+"?"+q.Encode())
	if err != nil {
		return nil, err
	}
	// One connection: a 12-room hotel never needs more, it keeps ":memory:"
	// a single database, and writes never wait on each other's locks.
	db.SetMaxOpenConns(1)
	s := &Store{DB: db, Now: time.Now}
	if _, err := s.migrate(context.Background()); err != nil {
		db.Close()
		return nil, err
	}
	return s, nil
}

func (s *Store) Close() error { return s.DB.Close() }

// migrate applies NNN_name.sql files in order. The database file remembers how
// many it has applied in PRAGMA user_version, so each file runs exactly once,
// in its own transaction (a failing migration leaves the database untouched).
func (s *Store) migrate(ctx context.Context) (int, error) {
	names, err := fs.Glob(migrations.Files, "*.sql")
	if err != nil {
		return 0, err
	}
	sort.Strings(names)
	var version int
	if err := s.DB.QueryRowContext(ctx, "PRAGMA user_version").Scan(&version); err != nil {
		return 0, err
	}
	for _, name := range names {
		n, err := strconv.Atoi(strings.SplitN(name, "_", 2)[0])
		if err != nil {
			return version, fmt.Errorf("migration %s: name must start with a number", name)
		}
		if n <= version {
			continue
		}
		if n != version+1 {
			return version, fmt.Errorf("migration gap: database is at %d, next file is %s", version, name)
		}
		body, err := migrations.Files.ReadFile(name)
		if err != nil {
			return version, err
		}
		err = s.tx(ctx, func(tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, string(body)); err != nil {
				return fmt.Errorf("migration %s: %w", name, err)
			}
			_, err := tx.ExecContext(ctx, fmt.Sprintf("PRAGMA user_version = %d", n))
			return err
		})
		if err != nil {
			return version, err
		}
		version = n
	}
	return version, nil
}

// tx runs fn in one transaction: committed if fn returns nil, rolled back otherwise.
func (s *Store) tx(ctx context.Context, fn func(*sql.Tx) error) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ---- errors ------------------------------------------------------------------

// ValidationError: the request itself is wrong (HTTP 400).
type ValidationError struct{ Msg string }

func (e *ValidationError) Error() string { return e.Msg }

// UnavailableError: the rooms asked for are not free (HTTP 409).
type UnavailableError struct{ Msg string }

func (e *UnavailableError) Error() string { return e.Msg }

// NotFoundError (HTTP 404).
type NotFoundError struct{ Msg string }

func (e *NotFoundError) Error() string { return e.Msg }

// ForbiddenError: signed in, but not allowed (HTTP 403).
type ForbiddenError struct{ Msg string }

func (e *ForbiddenError) Error() string { return e.Msg }

func invalid(format string, a ...any) error { return &ValidationError{fmt.Sprintf(format, a...)} }

// fromTrigger turns the schema's RAISE(ABORT, ...) messages and constraint
// failures into the errors above. Anything else is returned unchanged (HTTP 500).
func fromTrigger(err error) error {
	if err == nil || isOurs(err) {
		return err
	}
	msg := err.Error()
	for _, m := range []string{
		"room already booked for these dates",
		"room is out of service",
		"cannot reinstate: a room is no longer free",
		"room has current or future bookings: move them first",
	} {
		if strings.Contains(msg, m) {
			return &UnavailableError{m}
		}
	}
	for _, m := range []string{
		"more guests than the room allows",
		"booking has started: shorten the stay instead of cancelling",
		"a current or future booking has more guests than this",
	} {
		if strings.Contains(msg, m) {
			return &ValidationError{m}
		}
	}
	if strings.Contains(msg, "constraint failed") {
		return &ValidationError{msg}
	}
	return err
}

func isOurs(err error) bool {
	var v *ValidationError
	var u *UnavailableError
	var n *NotFoundError
	var f *ForbiddenError
	return errors.As(err, &v) || errors.As(err, &u) || errors.As(err, &n) || errors.As(err, &f)
}

// ---- time ----------------------------------------------------------------------

// India has no daylight saving, so the hotel clock is always UTC+5:30
// (the room guards in 001_init.sql use the same offset).
var ist = time.FixedZone("IST", 330*60)

const dateLayout = "2006-01-02"

// HotelToday is the hotel-local calendar date of a moment.
func HotelToday(now time.Time) string { return now.In(ist).Format(dateLayout) }

func utcISO(t time.Time) string { return t.UTC().Format("2006-01-02T15:04:05Z") }

// audit writes one audit_log row in the SAME transaction as the edit it describes.
func audit(ctx context.Context, tx *sql.Tx, staffID *int64, action, entity string, entityID int64, details string) error {
	_, err := tx.ExecContext(ctx,
		"INSERT INTO audit_log (staff_user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)",
		staffID, action, entity, entityID, details)
	return err
}
