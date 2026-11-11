import { useState } from "react";
import {
  BedDouble,
  CalendarDays,
  Clock,
  Search,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { useBookingSearch, type BookingTab } from "../hooks/useBookingSearch";
import { buffetTimes } from "../data/site";
import { pluralize, range, todayISO } from "../utils/format";
import "./BookingWidget.css";

const tabs: { id: BookingTab; label: string; icon: typeof BedDouble }[] = [
  { id: "stay", label: "Stay", icon: BedDouble },
  { id: "buffet", label: "Buffet", icon: UtensilsCrossed },
];

export function BookingWidget({
  variant = "hero",
}: {
  variant?: "hero" | "inline";
}) {
  const { search, update, goToStayResults, goToBuffet } = useBookingSearch();
  const [tab, setTab] = useState<BookingTab>("stay");
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
    if (search.guests < 1) {
      setError("At least one guest is required.");
      return;
    }
    setError(null);
    goToStayResults();
  }

  function submitBuffet() {
    if (!search.date) {
      setError("Please choose a reservation date.");
      return;
    }
    if (search.partySize < 1) {
      setError("At least one guest is required.");
      return;
    }
    setError(null);
    goToBuffet();
  }

  const today = todayISO();

  return (
    <div
      className={`widget widget--${variant}`}
      role="search"
      aria-label="Booking search"
    >
      <div className="widget__tabs" role="tablist" aria-label="Booking type">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={tab === id ? `panel-${id}` : undefined}
            className={`widget__tab ${tab === id ? "widget__tab--active" : ""}`}
            onClick={() => {
              setTab(id);
              setError(null);
            }}
          >
            <Icon size={18} aria-hidden="true" /> {label}
          </button>
        ))}
      </div>

      <div className="widget__body">
        {tab === "stay" ? (
          <div
            id="panel-stay"
            role="tabpanel"
            aria-labelledby="tab-stay"
            className="widget__fields"
          >
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
        ) : (
          <div
            id="panel-buffet"
            role="tabpanel"
            aria-labelledby="tab-buffet"
            className="widget__fields"
          >
            <div className="field">
              <label htmlFor="w-date">Reservation date</label>
              <span className="widget__input-wrap">
                <CalendarDays size={17} aria-hidden="true" />
                <input
                  id="w-date"
                  className="input"
                  type="date"
                  min={today}
                  value={search.date}
                  onChange={(e) => update({ date: e.target.value })}
                />
              </span>
            </div>
            <div className="field">
              <label htmlFor="w-time">Preferred time</label>
              <span className="widget__input-wrap">
                <Clock size={17} aria-hidden="true" />
                <select
                  id="w-time"
                  className="select"
                  value={search.time}
                  onChange={(e) => update({ time: e.target.value })}
                >
                  {buffetTimes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="field">
              <label htmlFor="w-party">Guests</label>
              <span className="widget__input-wrap">
                <Users size={17} aria-hidden="true" />
                <select
                  id="w-party"
                  className="select"
                  value={search.partySize}
                  onChange={(e) =>
                    update({ partySize: Number(e.target.value) })
                  }
                >
                  {range(8).map((n) => (
                    <option key={n} value={n}>
                      {pluralize(n, "guest")}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <button
              type="button"
              className="btn btn--sunset widget__submit"
              onClick={submitBuffet}
            >
              <Search size={18} aria-hidden="true" /> Find a table
            </button>
          </div>
        )}
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
