import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AvailabilityQuery } from "../api/types";

export type BookingTab = "stay" | "restaurant";

interface SearchContext extends AvailabilityQuery {
  date: string;
  time: string;
  partySize: number;
}

interface BookingContextValue {
  search: SearchContext;
  update: (patch: Partial<SearchContext>) => void;
  goToStayResults: () => void;
  goToRestaurant: () => void;
}

const defaultSearch: SearchContext = {
  checkIn: "",
  checkOut: "",
  guests: 2,
  rooms: 1,
  date: "",
  time: "19:00",
  partySize: 2,
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<SearchContext>(defaultSearch);
  const navigate = useNavigate();

  const value = useMemo<BookingContextValue>(
    () => ({
      search,
      update: (patch) => setSearch((s) => ({ ...s, ...patch })),
      goToStayResults: () =>
        navigate("/stay", { state: { search: search as AvailabilityQuery } }),
      goToRestaurant: () => navigate("/restaurant", { state: { search } }),
    }),
    [search, navigate],
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBookingSearch(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBookingSearch must be used inside BookingProvider");
  return ctx;
}
