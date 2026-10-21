# Dharma Retreat House — Hotel & Restaurant Booking Website

A charity-operated hotel and restaurant website. All proceeds support the
Tashol Tengyur School, located in the same building. Guests book rooms and
restaurant tables online without creating an account.

## What's included

- **Homepage** with a full-screen hero (real photo in `public/dharmahouse-hero.jpg`)
  and a two-tab booking widget (Stay / Restaurant).
- **Stay** — room listing with date-based availability and total prices
  (taxes shown when the backend supplies them).
- **Room details** — gallery, amenities, per-date availability check and
  reservation flow.
- **Restaurant** — menu highlights, slot search and reservation flow.
- **Our Mission**, **Gallery**, **Contact** — editable content with clearly
  marked placeholders.
- **Manage booking** — account-free lookup and cancellation using a booking
  reference plus a secure code/link (the backend must verify the secure part).
- **Staff area** (`/staff`) — sign-in placeholder and dashboard skeleton.
  Real authentication and authorization must be enforced by the backend.

## Tech

- React + TypeScript + Vite
- React Router for navigation
- A single, isolated API layer in `src/api/`:

  - `contract.ts` — the interface the Go backend must fulfill
  - `client.ts` — chooses the implementation based on `VITE_API_BASE_URL`;
    also contains the starting point of the real HTTP client
  - `mock.ts` — mock adapter used when no API URL is configured.
    **Everything it returns is simulated** (availability, prices, bookings).

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and point `VITE_API_BASE_URL` at the Go backend
(e.g. `http://localhost:8080/api/v1`). Until a value is set, the app runs in
**preview mode** with the mock adapter, and the UI clearly labels simulated
data.

## Initial API contract (Go backend)

- `GET  /api/v1/rooms/availability` — availability + prices for dates/guests
- `POST /api/v1/bookings` — create a hotel booking
- `GET  /api/v1/bookings/{reference}` — booking details (secure token required)
- `POST /api/v1/bookings/cancel` — cancel with a secure token
- `GET  /api/v1/restaurant/availability` — available dining slots
- `POST /api/v1/restaurant/bookings` — create a restaurant reservation
- `/api/v1/staff/*` — authenticated staff operations

Adjust `src/api/client.ts` if the final routes or payload shapes differ —
components and hooks do not need to change.

## Deployment

```bash
npm run build
```

Deploy the `dist/` folder to any static host. Set `VITE_API_BASE_URL` at build
time to the public HTTPS URL of the Go API. The API must send permissive CORS
headers for the site's origin.

## Replacing placeholder content

- Images: `src/data/images.ts` (all placeholder slots are listed there; the
  hero photo lives at `public/dharmahouse-hero.jpg`).
- Names, contact details, policies: `src/data/site.ts`.
- Room catalog: `src/data/rooms.ts` (superseded by the backend once live).
- Placeholder texts marked with `[...]` in the Mission and Contact pages.
