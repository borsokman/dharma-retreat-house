# Dharma Retreat House: booking backend

Room bookings only (no restaurant/dinner bookings). Guests have no accounts: a booking is
found by its reference plus the secret manage link. Lives in `backend/`, next to `frontend/`;
each has its own `package.json` and `node_modules`.

    cd backend
    npm install          # .npmrc skips install scripts on purpose: no C++ compiler needed
    npm test             # Node tests: migrations, staff edits, audit log, bookings
    npm run test:schema  # SQL tests for the schema (python3 only, no packages)
    npm run typecheck

- `migrations/001_init.sql`: the whole database structure. Applied once per database file.
  Later structure changes go in `002_*.sql`, `003_*.sql`... never edit a migration that has run.
- `src/db.ts`: opens the database file (pragmas + migrations).
- `src/admin.ts`: staff edits (settings, room prices) with audit log.
- `src/bookings.ts`: availability per room type, price quotes and creating a booking.
  One booking can hold several rooms, each with its own guest count (1 to the room's
  `max_guests`, 2 for every room today). A party of 3 can therefore take 2 or 3 rooms;
  the house holds at most 12 rooms / 24 guests.
- The database file itself (`*.db`) is git-ignored. Back it up separately.
