import type { ApiClient } from "./contract";
import type { RoomAvailability, RoomType, StayQuoteRequest } from "./types";
import { mockApiClient } from "./mock";
import { rooms as roomContent } from "../data/rooms";

/**
 * Single place where the app binds to a backend implementation.
 *
 * - When VITE_API_BASE_URL is not set, the mock adapter is used so the
 *   interface can be previewed without the backend. Everything shown
 *   is simulated.
 * - With VITE_API_BASE_URL set (`npm run dev:api` uses "/api/v1"), the Go
 *   backend in ../backend answers. Room descriptions and photos stay in
 *   src/data/rooms.ts; prices and availability come from the backend.
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export const isMockMode = !BASE_URL;

export class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
  }
}

export async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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
    throw new ApiRequestError(
      res.status,
      String(message).charAt(0).toUpperCase() + String(message).slice(1),
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const query = (params: Record<string, string | number>) =>
  new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)]),
  ).toString();

/** One booking, several rooms: each room carries its own guest count. */
const stayBody = (req: StayQuoteRequest) => ({
  check_in: req.checkIn,
  check_out: req.checkOut,
  rooms: req.rooms.map((r) => ({ room_type: r.roomSlug, guests: r.guests })),
});

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

/** A room type as the backend sends it: prices only, no descriptions. */
interface ApiRoomType {
  slug: string;
  name: string;
  maxGuests: number;
  pricePerNight: number;
  currency: string;
}

/** The site's room text and photos with the backend's current price. */
function withBackendPrice(t: ApiRoomType): RoomType | null {
  const content = roomContent.find((r) => r.slug === t.slug);
  if (!content) return null;
  return {
    ...content,
    maxGuests: t.maxGuests || content.maxGuests,
    basePrice: t.pricePerNight,
    currency: t.currency,
  };
}

async function listRooms(): Promise<RoomType[]> {
  const types = await request<ApiRoomType[]>("/rooms");
  return types.map(withBackendPrice).filter((r): r is RoomType => r !== null);
}

export const httpApiClient: ApiClient = {
  listRooms,

  getRoom: async (slug) =>
    (await listRooms()).find((r) => r.slug === slug) ?? null,

  getAvailability: async (dates) => {
    const types = await request<
      (ApiRoomType & { roomsLeft: number; nights: number; stayPrice: number })[]
    >(
      `/rooms/availability?${query({
        check_in: dates.checkIn,
        check_out: dates.checkOut,
      })}`,
    );
    return types.flatMap((t): RoomAvailability[] => {
      const room = withBackendPrice(t);
      return room
        ? [
            {
              room,
              roomsLeft: t.roomsLeft,
              nights: t.nights,
              stayPrice: t.stayPrice,
              currency: t.currency,
            },
          ]
        : [];
    });
  },
  quoteStay: (req) => post("/bookings/quote", stayBody(req)),
  createHotelBooking: (req) =>
    post("/bookings", {
      ...stayBody(req),
      contact: req.contact,
      special_requests: req.specialRequests,
    }),
  getHotelBooking: (ref, token) =>
    request(`/bookings/${encodeURIComponent(ref)}?${query({ token })}`),
  cancelHotelBooking: (ref, token) =>
    post("/bookings/cancel", { reference: ref, token }),
};

export const api: ApiClient = isMockMode ? mockApiClient : httpApiClient;
