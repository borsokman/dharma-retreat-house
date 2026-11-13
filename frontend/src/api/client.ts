import type { ApiClient } from "./contract";
import { mockApiClient } from "./mock";

/**
 * Single place where the app binds to a backend implementation.
 *
 * - When VITE_API_BASE_URL is not set, the mock adapter is used so the
 *   interface can be previewed without the Go backend. Everything shown
 *   is simulated.
 * - The real HTTP implementation (httpApiClient below) is the starting
 *   point for the Go API contract — fill in the exact routes/payloads
 *   agreed with the backend and set VITE_API_BASE_URL.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const isMockMode = !BASE_URL;

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
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

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const httpApiClient: ApiClient = {
  listRooms: () => request("/rooms"),

  getRoom: (slug) =>
    request<Awaited<ReturnType<ApiClient["getRoom"]>>>(
      `/rooms/${encodeURIComponent(slug)}`,
    ).catch((err) => {
      if (err instanceof ApiRequestError && err.status === 404) return null;
      throw err;
    }),

  // The methods below mirror the initial API contract. Adjust paths and
  // payload shapes here when the Go API is finalized — components and
  // hooks stay untouched.
  getAvailability: (q) =>
    request(
      `/rooms/availability?${query({
        check_in: q.checkIn,
        check_out: q.checkOut,
        guests: q.guests,
        rooms: q.rooms,
      })}`,
    ),
  createHotelBooking: (req) =>
    post("/bookings", {
      room_slug: req.roomSlug,
      check_in: req.availabilityQuery.checkIn,
      check_out: req.availabilityQuery.checkOut,
      guests: req.availabilityQuery.guests,
      rooms: req.availabilityQuery.rooms,
      contact: req.contact,
      special_requests: req.specialRequests,
    }),
  getHotelBooking: (ref, token) =>
    request(`/bookings/${encodeURIComponent(ref)}?${query({ token })}`),
  cancelHotelBooking: (ref, token) =>
    post("/bookings/cancel", { reference: ref, token }),
};

export const api: ApiClient = isMockMode ? mockApiClient : httpApiClient;
