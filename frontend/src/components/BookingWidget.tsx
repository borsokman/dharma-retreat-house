import { useState } from "react";
import { CalendarDays, Search, Users } from "lucide-react";
import { useBookingSearch } from "../hooks/useBookingSearch";
import { pluralize, range, todayISO } from "../utils/format";
import "./BookingWidget.css";

/** Room availability search shown on the homepage hero. */
export function BookingWidget() {
  const { search, update, goToStayResults } = useBookingSearch();
  const [error, setError] = useState<string | null>(null);

  function submitStay() {
    if (!search.checkIn || !search.checkOut) {
      setError("Please choose your check-in and check-out dates.");
      return;
    }
    if (search.checkOut <= search.checkIn) {
      setError("Check-out must be after check-in.");
      return;
    }
    setError(null);
    goToStayResults();
  }

  const today = todayISO();

  return (
    <div
      className="widget widget--hero"
      role="search"
      aria-label="Search room availability"
    >
      <div className="widget__body">
        <div className="widget__fields">
          <div className="field">
            <label htmlFor="w-checkin">Check-in</label>
            <span className="widget__input-wrap">
              <CalendarDays size={17} aria-hidden="true" />
              <input
                id="w-checkin"
                className="input"
                type="date"
                min={today}
                value={search.checkIn}
                onChange={(e) =>
                  update({
                    checkIn: e.target.value,
                    checkOut:
                      search.checkOut && search.checkOut <= e.target.value
                        ? ""
                        : search.checkOut,
                  })
                }
              />
            </span>
          </div>
          <div className="field">
            <label htmlFor="w-checkout">Check-out</label>
            <span className="widget__input-wrap">
              <CalendarDays size={17} aria-hidden="true" />
              <input
                id="w-checkout"
                className="input"
                type="date"
                min={search.checkIn || today}
                value={search.checkOut}
                onChange={(e) => update({ checkOut: e.target.value })}
              />
            </span>
          </div>
          <div className="field">
            <label htmlFor="w-guests">Guests</label>
            <span className="widget__input-wrap">
              <Users size={17} aria-hidden="true" />
              <select
                id="w-guests"
                className="select"
                value={search.guests}
                onChange={(e) => update({ guests: Number(e.target.value) })}
              >
                {range(6).map((n) => (
                  <option key={n} value={n}>
                    {pluralize(n, "guest")}
                  </option>
                ))}
              </select>
            </span>
          </div>
          <div className="field">
            <label htmlFor="w-rooms">Rooms</label>
            <select
              id="w-rooms"
              className="select"
              value={search.rooms}
              onChange={(e) => update({ rooms: Number(e.target.value) })}
            >
              {range(3).map((n) => (
                <option key={n} value={n}>
                  {pluralize(n, "room")}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="btn btn--sunset widget__submit"
            onClick={submitStay}
          >
            <Search size={18} aria-hidden="true" /> Search availability
          </button>
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
