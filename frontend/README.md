# Dharma Retreat House — Hotel Booking Website

A charity-operated hotel website. All proceeds support the Tashol Tengyur
School, located in the same building. Guests book rooms online without
creating an account: a booking is managed with its reference number.

## What's included

- **Homepage** with a full-screen hero (light/dark photos in `public/`).
- **Booking** (`/book`) — every "Book Now" button opens it. Dates, guests and
  rooms (up to 2 guests per room, 12 rooms), then the guest picks each room
  step by step ("Room 1 of 2 — for 2 guests"), then a price summary and
  contact details. One booking can hold several rooms.
- **Stay** (`/stay`) — every room type as a wide card: photos, facts,
  description, amenities, price and a "Book this room" button
  (`/book?room=<slug>` pre-selects it). `/stay#<slug>` jumps to one room.
- **Our Mission**, **Gallery**, **Contact** — editable content with clearly
  marked placeholders.
- **Manage booking** — account-free lookup and cancellation using a booking
  reference plus a secure code/link (the backend must verify the secure part).
- **Staff area** (`/staff`) — sign-in and dashboard: every booking with the
  guest's email, phone, dates and room numbers; confirm, check in/out, cancel;
  move guests to another room; mark rooms unavailable (hidden from the booking
  form). Needs the backend: see `../backend/README.md`.

## Tech

- React + TypeScript + Vite
- React Router for navigation
- A single, isolated API layer in `src/api/`:
  - `contract.ts` — the interface the backend must fulfill
  - `client.ts` — chooses the implementation based on `VITE_API_BASE_URL`;
    the HTTP client merges the backend's prices with the room text and photos
    in `src/data/rooms.ts`
  - `staff.ts` — the staff dashboard API (backend only, no mock)
  - `mock.ts` — mock adapter used when no API URL is configured.
    **Everything it returns is simulated** (availability, prices, bookings).

## Getting started

```bash
npm install
npm run dev
```

`npm run dev` runs in **preview mode** with the mock adapter: simulated
prices and availability, no staff area.

`npm run dev:api` uses the real Go backend (start it first, see
`../backend/README.md`). Vite proxies `/api` to `127.0.0.1:8080`, so the site
and the API share one origin and the staff session cookie works.

## API (backend/internal/api)

- `GET  /api/v1/rooms` — room types with current prices
- `GET  /api/v1/rooms/availability?check_in&check_out` — free rooms per room type + prices
- `POST /api/v1/bookings/quote` — price for `rooms: [{ room_type, guests }]`
- `POST /api/v1/bookings` — create one booking holding one or more rooms
- `GET  /api/v1/bookings/{reference}` — booking details (secure token required)
- `POST /api/v1/bookings/cancel` — cancel with a secure token
- `POST /api/v1/staff/login`, `/logout`, `GET /staff/me`, `GET /staff/today`
- `GET  /api/v1/staff/bookings?view&q`, `GET|PATCH /staff/bookings/{id}`
- `GET  /api/v1/staff/bookings/{id}/stays/{stay}/options`, `POST .../move`
- `GET  /api/v1/staff/rooms`, `PATCH /staff/rooms/{number}`

## Deployment

```bash
npm run build
```

Serve the `dist/` folder and the backend's `/api` from the same HTTPS domain
(e.g. Caddy or nginx in front of `drh serve`), and build with
`VITE_API_BASE_URL=/api/v1`. Same origin keeps the staff cookie strict and
needs no CORS.

## Replacing placeholder content

- Images: `src/data/images.ts` (all placeholder slots are listed there).
- Names, contact details, policies: `src/data/site.ts`.
- Room text and photos: `src/data/rooms.ts`. With the backend, prices come
  from its database (in INR); the USD prices in this file are preview only.
- Placeholder texts marked with `[...]` in the Mission and Contact pages.
