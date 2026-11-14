# Dharma Retreat House: booking backend (Go)

Room bookings and the staff dashboard API. One Go program, `drh`, with SQLite in a single
file. Guests have no accounts: a booking is found by its reference plus a secret code.
Staff sign in with email and password.

Needs Go 1.24 or newer. No C compiler: the SQLite driver is pure Go.

## Try it locally (website + staff dashboard)

    cd backend
    go build -o bin/drh ./cmd/drh

    # once: a staff account and some made-up bookings in a development database
    ./bin/drh staff add you@example.com "Your Name" -role admin -db drh-dev.db
    ./bin/drh demo -db drh-dev.db

    # every time: the API on 127.0.0.1:8080
    ./bin/drh serve -dev -db drh-dev.db

Then in another terminal:

    cd frontend
    npm run dev:api          # the website, talking to the backend through Vite's proxy

Open http://localhost:5173/staff and sign in. `-dev` allows the session cookie over plain
http; never use it on the real server. (`npm run dev` without `:api` still runs the site on
simulated data, without the backend.)

## Commands

    drh serve [-addr 127.0.0.1:8080] [-db drh.db] [-dev] [-allow-origin https://example.com]
    drh staff add EMAIL "FULL NAME" [-role admin|staff]   # asks for the password twice
    drh staff password EMAIL                             # new password, signs out everywhere
    drh staff disable EMAIL / drh staff enable EMAIL     # disable signs out at once
    drh staff list
    drh demo                                             # made-up bookings, EMPTY database only

Every command takes `-db` (default: `$DRH_DB`, else `drh.db`). `serve` also reads `$DRH_ADDR`.

## Tests

    go test ./...                  # bookings, staff sign-in, dashboard actions, HTTP layer
    python3 tests/schema_tests.py  # SQL tests for the schema itself (python3 only)

## Layout

- `migrations/`: the database structure, compiled into the binary. `001_init.sql` is the
  whole starting schema (tables, triggers that stop double bookings, views, staff sessions).
  Later changes go in new files `002_*.sql`, `003_*.sql`... and never into a file that has
  already run on a database: each database remembers which files it applied, and runs
  each one only once.
- `internal/store/`: every rule.
  - `bookings.go`: availability, prices, booking, guest lookup and cancellation.
  - `staff.go`: staff accounts, passwords, sessions.
  - `dashboard.go`: booking lists, status changes, moving guests, closing rooms.
  - `settings.go`: settings and room prices (admins only).
- `internal/api/`: HTTP routes and JSON (`/api/v1/...`), the session cookie, login throttling.
- `cmd/drh/`: the command above.

## How the main rules work

- **Rooms per party.** 12 rooms, at most 2 guests each. A booking can hold several rooms,
  each with its own guest count, so 3 guests take 2 or 3 rooms.
- **No double booking.** Triggers in the schema refuse any stay that shares a night with
  another one in the same room, inside the same write. A guest who loses a race for the last
  room gets "a room was just taken".
- **Paying.** No payment provider is connected yet. Website bookings start as
  *Awaiting payment*, and staff press **Confirm (paid)** once the guest has paid.
- **Unavailable rooms.** When staff mark a room unavailable, it stops counting in
  availability at once, so the booking form no longer offers it. A room with current or
  future guests cannot be closed until they are moved (Bookings → Change room).
- **Changing rooms.** A guest can move to any free room for the same dates. They keep the
  price they booked, unless staff tick "charge the new room's price".
- **Audit log.** Every staff change (status, room move, notes, room closed, settings,
  prices) writes an `audit_log` row in the same transaction. The dashboard shows each
  booking's history.

## Security

- **Passwords:** stored as bcrypt hashes (cost 12), at least 10 characters.
- **Sessions:** a random token in an HttpOnly, SameSite=Strict cookie; only its SHA-256 hash
  is stored. A session lasts 12 hours. A new password or a disabled account ends every
  session of that account.
- **Login throttling:** after 5 wrong passwords for one email from one address (or 20 from
  one address), sign-in from there waits 15 minutes.
- **Cross-site requests:** changes must be JSON sent from the site's own origin. Together
  with the SameSite cookie, this stops other sites from acting as a signed-in staff member.
- **Guest manage links:** only the hash of the secret code is stored.

On the real server, run `drh serve` behind HTTPS (e.g. Caddy or nginx), serve the built
frontend and `/api` from the same domain, and back up the database file regularly. The
`*.db` files are git-ignored.
