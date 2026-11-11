import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AvailabilityQuery } from "../api/types";

export type BookingTab = "stay" | "buffet";

/** Router state the rooms page receives after an availability search. */
export interface StayPageState {
  search: AvailabilityQuery;
}

interface SearchContext extends AvailabilityQuery {
  date: string;
  time: string;
  partySize: number;
}

interface BookingContextValue {
  search: SearchContext;
  update: (patch: Partial<SearchContext>) => void;
  goToStayResults: () => void;
  goToBuffet: () => void;
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
      goToStayResults: () => {
        const query: AvailabilityQuery = {
          checkIn: search.checkIn,
          checkOut: search.checkOut,
          guests: search.guests,
          rooms: search.rooms,
        };
        navigate("/stay", { state: { search: query } satisfies StayPageState });
      },
      // The buffet page reads date / party size straight from this context.
      goToBuffet: () => navigate("/buffet"),
    }),
    [search, navigate],
  );

  return (
    <BookingContext.Provider value={value}>{children}</BookingContext.Provider>
  );
}

export function useBookingSearch(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx)
    throw new Error("useBookingSearch must be used inside BookingProvider");
  return ctx;
}
