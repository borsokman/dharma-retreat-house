import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { BookingWidget } from "../components/BookingWidget";
import { AvailabilityResults } from "../components/AvailabilityResults";
import { useBookingSearch } from "../hooks/useBookingSearch";
import type { AvailabilityQuery } from "../api/types";
import { isMockMode } from "../api/client";

export default function RoomsPage() {
  const location = useLocation();
  const { search } = useBookingSearch();

  const query: AvailabilityQuery | null = useMemo(() => {
    const fromState = (location.state as { search?: AvailabilityQuery } | null)
      ?.search;
    const q = fromState ?? search;
    if (q.checkIn && q.checkOut && q.checkOut > q.checkIn) {
      return {
        checkIn: q.checkIn,
        checkOut: q.checkOut,
        guests: q.guests,
        rooms: q.rooms,
      };
    }
    return null;
  }, [location.state, search]);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Stay with us</span>
          <h1>Rooms &amp; suites</h1>
          <p className="lede">
            Choose your dates and we'll show you which rooms are free and what
            your stay really costs — taxes included.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--space-4)" }}>
        <div className="container">
          {isMockMode && (
            <p className="badge badge--clay" role="note" style={{ marginBottom: 16 }}>
              Preview mode — availability and prices are simulated
            </p>
          )}
          <BookingWidget variant="inline" />
        </div>
      </section>

      <section className="section section--sage" aria-live="polite" style={{ paddingTop: "var(--space-5)" }}>
        <div className="container">
          {query ? (
            <AvailabilityResults query={query} />
          ) : (
            <div className="card text-center">
              <h3>Pick your dates above</h3>
              <p className="lede">
                Choose a check-in and check-out date to see live availability
                and the total price for your stay.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
