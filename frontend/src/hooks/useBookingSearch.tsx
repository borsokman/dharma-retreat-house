import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AvailabilityQuery } from "../api/types";

/** Router state the rooms page receives after an availability search. */
export interface StayPageState {
  search: AvailabilityQuery;
}

interface BookingContextValue {
  search: AvailabilityQuery;
  update: (patch: Partial<AvailabilityQuery>) => void;
  goToStayResults: () => void;
}

const defaultSearch: AvailabilityQuery = {
  checkIn: "",
  checkOut: "",
  guests: 2,
  rooms: 1,
};

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [search, setSearch] = useState<AvailabilityQuery>(defaultSearch);
  const navigate = useNavigate();

  const value = useMemo<BookingContextValue>(
    () => ({
      search,
      update: (patch) => setSearch((s) => ({ ...s, ...patch })),
      goToStayResults: () =>
        navigate("/stay", { state: { search } satisfies StayPageState }),
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
