package store

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

// SessionLifetime: a staff sign-in lasts one working day, then asks again.
const SessionLifetime = 12 * time.Hour

const minPasswordLength = 10

type StaffUser struct {
	ID     int64
	Email  string
	Name   string
	Role   string // admin | staff
	Active bool
}

// AuthError: wrong email or password, or an expired session (HTTP 401).
type AuthError struct{ Msg string }

func (e *AuthError) Error() string { return e.Msg }

// dummyHash is compared against when the email is unknown, so a wrong email takes
// as long as a wrong password and the response does not reveal which accounts exist.
var dummyHash, _ = bcrypt.GenerateFromPassword([]byte("not-a-real-password"), bcrypt.DefaultCost)

func normEmail(e string) string { return strings.ToLower(strings.TrimSpace(e)) }

func hashPassword(password string) (string, error) {
	if len(password) < minPasswordLength {
		return "", invalid("the password must have at least %d characters", minPasswordLength)
	}
	if len(password) > 72 { // bcrypt ignores everything after 72 bytes
		return "", invalid("the password may have at most 72 characters")
	}
	h, err := bcrypt.GenerateFromPassword([]byte(password), 12)
	return string(h), err
}

// CreateStaff adds a staff account. Role is "admin" or "staff".
func (s *Store) CreateStaff(ctx context.Context, email, name, password, role string) (*StaffUser, error) {
	email, name = normEmail(email), strings.TrimSpace(name)
	if !emailRe.MatchString(email) || name == "" {
		return nil, invalid("a valid email and a name are required")
	}
	if role != "admin" && role != "staff" {
		return nil, invalid("role must be admin or staff")
	}
	hash, err := hashPassword(password)
	if err != nil {
		return nil, err
	}
	res, err := s.DB.ExecContext(ctx,
		"INSERT INTO staff_users (email, name, password_hash, role) VALUES (?, ?, ?, ?)", email, name, hash, role)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed: staff_users.email") {
			return nil, invalid("a staff account with this email already exists")
		}
		return nil, err
	}
	id, _ := res.LastInsertId()
	return &StaffUser{ID: id, Email: email, Name: name, Role: role, Active: true}, nil
}

// SetStaffPassword replaces a password and signs that account out everywhere.
func (s *Store) SetStaffPassword(ctx context.Context, email, password string) error {
	hash, err := hashPassword(password)
	if err != nil {
		return err
	}
	return s.tx(ctx, func(tx *sql.Tx) error {
		var id int64
		err := tx.QueryRowContext(ctx, "SELECT id FROM staff_users WHERE email = ?", normEmail(email)).Scan(&id)
		if err == sql.ErrNoRows {
			return &NotFoundError{"no staff account with this email"}
		}
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, "UPDATE staff_users SET password_hash = ? WHERE id = ?", hash, id); err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx, "DELETE FROM staff_sessions WHERE staff_user_id = ?", id)
		return err
	})
}

// SetStaffActive turns an account on or off. Turning it off signs it out at once.
func (s *Store) SetStaffActive(ctx context.Context, email string, active bool) error {
	return s.tx(ctx, func(tx *sql.Tx) error {
		res, err := tx.ExecContext(ctx, "UPDATE staff_users SET is_active = ? WHERE email = ?", boolInt(active), normEmail(email))
		if err != nil {
			return err
		}
		if n, _ := res.RowsAffected(); n == 0 {
			return &NotFoundError{"no staff account with this email"}
		}
		if !active {
			_, err = tx.ExecContext(ctx,
				"DELETE FROM staff_sessions WHERE staff_user_id = (SELECT id FROM staff_users WHERE email = ?)", normEmail(email))
		}
		return err
	})
}

func (s *Store) ListStaff(ctx context.Context) ([]StaffUser, error) {
	rows, err := s.DB.QueryContext(ctx, "SELECT id, email, name, role, is_active FROM staff_users ORDER BY email")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []StaffUser
	for rows.Next() {
		var u StaffUser
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Active); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

// Login checks the password and opens a session. It returns the session token for
// the cookie; only its hash is stored.
func (s *Store) Login(ctx context.Context, email, password string) (string, *StaffUser, time.Time, error) {
	var u StaffUser
	var hash string
	err := s.DB.QueryRowContext(ctx,
		"SELECT id, email, name, role, is_active, password_hash FROM staff_users WHERE email = ?", normEmail(email),
	).Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Active, &hash)
	if err != nil && err != sql.ErrNoRows {
		return "", nil, time.Time{}, err
	}
	if err == sql.ErrNoRows {
		bcrypt.CompareHashAndPassword(dummyHash, []byte(password))
		return "", nil, time.Time{}, &AuthError{"wrong email or password"}
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil || !u.Active {
		return "", nil, time.Time{}, &AuthError{"wrong email or password"}
	}

	now := s.Now()
	expires := now.Add(SessionLifetime)
	token := randomToken(32)
	err = s.tx(ctx, func(tx *sql.Tx) error {
		if _, err := tx.ExecContext(ctx, "DELETE FROM staff_sessions WHERE expires_at <= ?", utcISO(now)); err != nil {
			return err
		}
		_, err := tx.ExecContext(ctx, "INSERT INTO staff_sessions (token_hash, staff_user_id, expires_at) VALUES (?, ?, ?)",
			HashToken(token), u.ID, utcISO(expires))
		return err
	})
	if err != nil {
		return "", nil, time.Time{}, err
	}
	return token, &u, expires, nil
}

// SessionUser returns who a session token belongs to. Expired sessions and
// deactivated accounts are refused.
func (s *Store) SessionUser(ctx context.Context, token string) (*StaffUser, error) {
	if token == "" {
		return nil, &AuthError{"please sign in"}
	}
	var u StaffUser
	err := s.DB.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u.role, u.is_active
		FROM staff_sessions ss JOIN staff_users u ON u.id = ss.staff_user_id
		WHERE ss.token_hash = ? AND ss.expires_at > ? AND u.is_active = 1`,
		HashToken(token), utcISO(s.Now())).Scan(&u.ID, &u.Email, &u.Name, &u.Role, &u.Active)
	if err == sql.ErrNoRows {
		return nil, &AuthError{"your session has ended: please sign in again"}
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Store) Logout(ctx context.Context, token string) error {
	_, err := s.DB.ExecContext(ctx, "DELETE FROM staff_sessions WHERE token_hash = ?", HashToken(token))
	return err
}
