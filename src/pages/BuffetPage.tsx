import { useState } from "react";
import { Clock, Leaf, Users, UtensilsCrossed } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useBookingSearch } from "../hooks/useBookingSearch";
import { BuffetBookingModal } from "../components/BuffetBookingModal";
import { images } from "../data/images";
import { policies } from "../data/site";
import { pluralize, range, todayISO } from "../utils/format";
import type { BuffetSlot } from "../api/types";
import "./BuffetPage.css";

const menuHighlights = [
  {
    name: "Menu Spread:",
    description:
      "Steaming hot Rice, Dal Fry, Fresh Seasonal Vegetables, Authentic Local Seasonal Dishes, and Choice of Selected Chicken or Fish dishes.",
  },
  {
    name: "Accompaniments:",
    description: "Warm sourdough with a slow-cooked soup from our garden.",
  },
  {
    name: "Beverage:",
    description:
      "Includes a complimentary cup of hot Tea or Coffee with your meal.",
  },
];

export default function BuffetPage() {
  const { search } = useBookingSearch();
  const { state, run, reset } = useAsync<BuffetSlot[]>();
  const [date, setDate] = useState(search.date || todayISO(1));
  const [partySize, setPartySize] = useState(search.partySize);
  const [time, setTime] = useState(search.time);
  const [modalOpen, setModalOpen] = useState(false);

  function findSlots() {
    void run(() => api.getBuffetSlots({ date, partySize }));
  }

  const slots = state.kind === "done" ? state.data : null;
  const openSlots = slots?.filter((s) => s.available) ?? [];
  const chosenSlotOpen = openSlots.some((s) => s.time === time);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">The buffet</span>
          <h1>Good food, good purpose</h1>
          <p className="lede">
            Seasonal, locally sourced dishes served in our relaxed dining room.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--space-4)" }}>
        <div className="container rest-grid">
          <div className="rest-photo" aria-label="Dining buffet">
            <img
              src={images.buffet.interior}
              alt="A freshly prepared buffet spread in the dining room"
              loading="lazy"
              width="940"
              height="650"
            />
          </div>
          <div>
            <h2>
              <UtensilsCrossed size={22} aria-hidden="true" /> Our kitchen
            </h2>
            <p className="lede">
              Enjoy a delicious, freshly cooked buffet dinner prepared with care
              for our staying guests.
            </p>
            <h3 className="mt-2">Menu highlights</h3>
            <ul className="rest-menu">
              {menuHighlights.map((m) => (
                <li key={m.name}>
                  <strong>{m.name}</strong>
                  <span>{m.description}</span>
                </li>
              ))}
            </ul>
            <p className="rest-policy">
              <Clock size={16} aria-hidden="true" /> Served daily from 7:00 PM
              to 9:00 PM (Ground Floor Dining)
            </p>
            <p className="rest-policy">{policies.buffetCancellation}</p>
          </div>
        </div>
      </section>

      <section
        className="section section--sage"
        aria-labelledby="reserve-title"
      >
        <div className="container">
          <div className="section-head section-head--center">
            <span className="eyebrow">Reservations</span>
            <h2 id="reserve-title">Reserve a table</h2>
            <p className="lede">
              Choose a date and party size, then pick one of the times the
              kitchen has free.
            </p>
            {isMockMode && (
              <p className="badge badge--clay" role="note">
                Preview mode — available times are simulated
              </p>
            )}
          </div>

          <div className="rest-search card">
            <div className="field">
              <label htmlFor="rest-date">Date</label>
              <input
                id="rest-date"
                className="input"
                type="date"
                min={todayISO()}
                value={date}
                onChange={(e) => {
                  setDate(e.target.value);
                  reset(); // times shown belong to the previous date
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="rest-party">Guests</label>
              <span className="rest-input-icon">
                <Users size={17} aria-hidden="true" />
                <select
                  id="rest-party"
                  className="select"
                  value={partySize}
                  onChange={(e) => {
                    setPartySize(Number(e.target.value));
                    reset();
                  }}
                >
                  {range(8).map((n) => (
                    <option key={n} value={n}>
                      {pluralize(n, "guest")}
                    </option>
                  ))}
                </select>
              </span>
            </div>
            <div className="field">
              <label htmlFor="rest-time">Preferred time</label>
              <span className="rest-input-icon">
                <Clock size={17} aria-hidden="true" />
                <input
                  id="rest-time"
                  className="input"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                />
              </span>
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={findSlots}
              disabled={state.kind === "loading" || !date}
            >
              {state.kind === "loading" ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Looking…
                </>
              ) : (
                "Find a table"
              )}
            </button>
          </div>

          {state.kind === "error" && (
            <div className="card text-center mt-2" role="alert">
              <h3>We couldn't load times</h3>
              <p className="lede">{state.message}</p>
              <button
                type="button"
                className="btn btn--primary"
                onClick={findSlots}
              >
                Try again
              </button>
            </div>
          )}

          {slots && (
            <div className="mt-4">
              {openSlots.length > 0 ? (
                <>
                  <h3 className="text-center">Free times on this date</h3>
                  <div className="slot-grid slot-grid--page">
                    {openSlots.map((s) => (
                      <button
                        key={s.time}
                        type="button"
                        className={`slot ${time === s.time ? "slot--selected" : ""}`}
                        aria-pressed={time === s.time}
                        onClick={() => setTime(s.time)}
                      >
                        {s.time}
                      </button>
                    ))}
                  </div>
                  <div className="text-center mt-4">
                    <button
                      type="button"
                      className="btn btn--sunset"
                      onClick={() => setModalOpen(true)}
                    >
                      {chosenSlotOpen
                        ? `Continue with ${time}`
                        : "Choose a time, then continue"}
                    </button>
                  </div>
                </>
              ) : (
                <div className="card text-center">
                  <h3>Fully booked</h3>
                  <p className="lede">
                    We're sorry — there are no tables left at this size on this
                    date. Please try another date, a smaller party, or call us
                    and we'll do our best.
                  </p>
                </div>
              )}
            </div>
          )}

          {!slots && state.kind !== "loading" && (
            <p className="lede text-center mt-4">
              <Leaf size={16} aria-hidden="true" /> Pick a date above and press
              "Find a table" to see what's free.
            </p>
          )}
        </div>
      </section>

      {modalOpen && slots && (
        <BuffetBookingModal
          date={date}
          partySize={partySize}
          slots={slots}
          initialTime={chosenSlotOpen ? time : null}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
