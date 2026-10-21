# Dharma Retreat House: booking backend

Lives in its own folder (`backend/`) inside the frontend repo. It has its own `package.json`
and `node_modules`, so it never clashes with the frontend at the repo root.

    cd backend
    npm install          # .npmrc skips install scripts on purpose: no C++ compiler needed
    npm test              # Node tests: migrations, staff edits, audit log
    npm run test:schema   # SQL tests for the schema (python3 only, no packages)
    npm run typecheck

- `migrations/001_init.sql`: the whole database structure. Applied once per database file.
  Later structure changes go in `002_*.sql`, `003_*.sql`... never edit a migration that has run.
- `src/db.ts`: opens the database file (pragmas + migrations).
- `src/admin.ts`: staff edits (settings, room prices) with audit log.
- The database file itself (`*.db`) is git-ignored. Back it up separately.
