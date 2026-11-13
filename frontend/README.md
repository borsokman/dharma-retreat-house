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
- **Stay** — room listing; **Room details** — gallery, amenities and a
  "Book this room" button (`/book?room=<slug>` pre-selects it).
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
  - `contract.ts` — the interface the backend must fulfill
  - `client.ts` — chooses the implementation based on `VITE_API_BASE_URL`;
    also contains the starting point of the real HTTP client
  - `mock.ts` — mock adapter used when no API URL is configured.
    **Everything it returns is simulated** (availability, prices, bookings).

## Getting started

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env` and point `VITE_API_BASE_URL` at the backend
(e.g. `http://localhost:8080/api/v1`). Until a value is set, the app runs in
**preview mode** with the mock adapter, and the UI clearly labels simulated
data.

## Initial API contract (backend)

- `GET  /api/v1/rooms` — room catalogue
- `GET  /api/v1/rooms/{slug}` — one room (404 when unknown)
- `GET  /api/v1/rooms/availability?check_in&check_out` — free rooms per room type + prices
- `POST /api/v1/bookings/quote` — price for `rooms: [{ room_type, guests }]`
- `POST /api/v1/bookings` — create one booking holding one or more rooms
- `GET  /api/v1/bookings/{reference}` — booking details (secure token required)
- `POST /api/v1/bookings/cancel` — cancel with a secure token
- `/api/v1/staff/*` — authenticated staff operations

Adjust `src/api/client.ts` if the final routes or payload shapes differ —
components and hooks do not need to change.

## Deployment

```bash
npm run build
```

Deploy the `dist/` folder to any static host. Set `VITE_API_BASE_URL` at build
time to the public HTTPS URL of the API. The API must send permissive CORS
headers for the site's origin.

## Replacing placeholder content

- Images: `src/data/images.ts` (all placeholder slots are listed there).
- Names, contact details, policies: `src/data/site.ts`.
- Room catalog: `src/data/rooms.ts` (superseded by the backend once live).
- Placeholder texts marked with `[...]` in the Mission and Contact pages.
