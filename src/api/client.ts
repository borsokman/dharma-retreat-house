import type { ApiClient } from "./contract";
import type { RoomType } from "./types";
import { mockApiClient } from "./mock";

/**
 * Single place where the app binds to a backend implementation.
 *
 * - When VITE_API_BASE_URL is not set, the mock adapter is used so the
 *   interface can be previewed without the Go backend. Everything shown
 *   is simulated.
 * - The real HTTP implementation (httpApiClient below) is the starting
 *   point for the Go API contract — fill in the exact routes/payloads
 *   agreed with the backend and switch USE_MOCK to false.
 */
const USE_MOCK = !import.meta.env.VITE_API_BASE_URL;

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
    });
  } catch {
    throw new ApiRequestError(0, "Network error — please try again.");
  }
  if (!res.ok) {
    const message = await res
      .json()
      .then((b) => b?.message ?? res.statusText)
      .catch(() => res.statusText);
    throw new ApiRequestError(res.status, message);
  }
  return res.json() as Promise<T>;
}

export const httpApiClient: ApiClient = {
  listRooms: () => request("/rooms"),

  getRoom: (slug) => request<RoomType>(`/rooms/${slug}`),

  // The methods below mirror the initial API contract. Adjust paths and
  // payload shapes here when the Go API is finalized — components and
  // hooks stay untouched.
  getAvailability: (query) =>
    request(
      `/rooms/availability?check_in=${query.checkIn}&check_out=${query.checkOut}&guests=${query.guests}&rooms=${query.rooms}`,
    ),
  createHotelBooking: (req) =>
    request("/bookings", {
      method: "POST",
      body: JSON.stringify({
        room_slug: req.roomSlug,
        check_in: req.availabilityQuery.checkIn,
        check_out: req.availabilityQuery.checkOut,
        guests: req.availabilityQuery.guests,
        rooms: req.availabilityQuery.rooms,
        contact: req.contact,
        special_requests: req.specialRequests,
      }),
    }),
  getHotelBooking: (ref, token) =>
    request(`/bookings/${ref}?token=${encodeURIComponent(token)}`),
  cancelHotelBooking: (ref, token) =>
    request("/bookings/cancel", {
      method: "POST",
      body: JSON.stringify({ reference: ref, token }),
    }),
  getRestaurantSlots: (query) =>
    request(
      `/restaurant/availability?date=${query.date}&party_size=${query.partySize}`,
    ),
  createRestaurantBooking: (req) =>
    request("/restaurant/bookings", {
      method: "POST",
      body: JSON.stringify({
        date: req.date,
        time: req.time,
        party_size: req.partySize,
        contact: req.contact,
        special_requests: req.specialRequests,
      }),
    }),
};

export const api: ApiClient = USE_MOCK ? mockApiClient : httpApiClient;

export const isMockMode = USE_MOCK;

export { ApiRequestError };
