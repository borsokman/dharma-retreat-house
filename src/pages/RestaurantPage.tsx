import { useState } from "react";
import { Clock, Leaf, Users, UtensilsCrossed } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useBookingSearch } from "../hooks/useBookingSearch";
import { RestaurantBookingModal } from "../components/RestaurantBookingModal";
import { images } from "../data/images";
import { policies, site } from "../data/site";
import { todayISO } from "../utils/format";
import type { RestaurantSlot } from "../api/types";
import "./RestaurantPage.css";

const menuHighlights = [
  {
    name: "Seasonal vegetable thali",
    description:
      "A platter of the day's vegetables, dal, rice and fresh-baked flatbread.",
  },
  {
    name: "House sourdough & garden soup",
    description: "Warm sourdough with a slow-cooked soup from our garden.",
  },
  {
    name: "Mountain tea & honey cake",
    description: "A gentle finish with local honey and handmade cake.",
  },
];

export default function RestaurantPage() {
  const { search } = useBookingSearch();
  const { state, run } = useAsync<RestaurantSlot[]>();
  const [date, setDate] = useState(search.date || todayISO(1));
  const [partySize, setPartySize] = useState(search.partySize);
  const [time, setTime] = useState(search.time);
  const [modalOpen, setModalOpen] = useState(false);

  async function findSlots() {
    await run(() =>
      api.getRestaurantSlots({ date, partySize }),
    );
  }

  const slots = state.kind === "done" ? state.data : null;
  const chosenSlotExists = slots?.some((s) => s.time === time) ?? false;

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">The restaurant</span>
          <h1>Good food, good purpose</h1>
          <p className="lede">
            Seasonal, locally sourced dishes served in our relaxed dining room.
            Every meal supports {site.charityName}.
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--space-4)" }}>
        <div className="container rest-grid">
          <div className="rest-photo" aria-label="Placeholder — restaurant interior image">
            <img
              src={images.restaurant.interior}
              alt="Placeholder — here should be a restaurant interior image"
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
              Our cooks prepare honest food from what the season and nearby
              farms offer. Vegetarian dishes are a speciality, and the daily
              thali is a guest favourite.
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
              <Clock size={16} aria-hidden="true" /> Lunch 12:00–14:00 · Dinner
              18:00–21:00
            </p>
            <p className="rest-policy">{policies.restaurantCancellation}</p>
          </div>
        </div>
      </section>

      <section className="section section--sage" aria-labelledby="reserve-title">
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
                onChange={(e) => setDate(e.target.value)}
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
                  onChange={(e) => setPartySize(Number(e.target.value))}
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? "guest" : "guests"}
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
              disabled={state.kind === "loading"}
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
              <button type="button" className="btn btn--primary" onClick={findSlots}>
                Try again
              </button>
            </div>
          )}

          {slots && (
            <div className="mt-4">
              {slots.some((s) => s.available) ? (
                <>
                  <h3 className="text-center">Free times on this date</h3>
                  <div className="slot-grid slot-grid--page" role="list">
                    {slots
                      .filter((s) => s.available)
                      .map((s) => (
                        <button
                          key={s.time}
                          type="button"
                          role="listitem"
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
                      {chosenSlotExists
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
        <RestaurantBookingModal
          date={date}
          partySize={partySize}
          slots={slots}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
