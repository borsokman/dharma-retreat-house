import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Users, BedDouble, Ruler, Leaf } from "lucide-react";
import type { AvailabilityQuery, RoomAvailability } from "../api/types";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { formatMoney } from "../utils/format";
import { BookingRequestModal } from "./BookingRequestModal";
import "./RoomCard.css";

export function AvailabilityResults({ query }: { query: AvailabilityQuery }) {
  const { state, run } = useAsync<RoomAvailability[]>();
  const [selected, setSelected] = useState<RoomAvailability | null>(null);

  useEffect(() => {
    run(() => api.getAvailability(query));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.checkIn, query.checkOut, query.guests, query.rooms]);

  const results = useMemo(
    () => (state.kind === "done" ? state.data : null),
    [state],
  );

  if (state.kind === "loading") {
    return (
      <div className="avail__loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Checking availability…
      </div>
    );
  }

  if (state.kind === "error") {
    return (
      <div className="card text-center" role="alert">
        <h3>We couldn't check availability</h3>
        <p className="lede">{state.message}</p>
        <button
          type="button"
          className="btn btn--primary"
          onClick={() => run(() => api.getAvailability(query))}
        >
          Try again
        </button>
      </div>
    );
  }

  if (!results) return null;

  if (results.length === 0) {
    return (
      <div className="card text-center">
        <h3>No rooms fit this search</h3>
        <p className="lede">
          Try fewer guests per room or more rooms — or contact us directly and
          we'll find a solution.
        </p>
      </div>
    );
  }

  return (
    <div className="avail__list">
      {isMockMode && (
        <p className="badge badge--clay" role="note">
          Preview mode — availability and prices are simulated
        </p>
      )}
      {results.map(({ room, available, totalPrice, currency, nights, taxesAndFees }) => (
        <article
          key={room.slug}
          className={`room-card card card--hover ${available ? "" : "room-card--unavailable"}`}
          aria-label={`${room.name}${available ? ", available" : ", unavailable"}`}
        >
          <div className="room-card__photo">
            <img
              src={room.photos[0]}
              alt={room.name}
              loading="lazy"
              width="940"
              height="650"
            />
            {!available && (
              <span className="room-card__flag">Unavailable for these dates</span>
            )}
          </div>
          <div className="room-card__body">
            <h3>{room.name}</h3>
            <p className="lede">{room.shortDescription}</p>
            <ul className="room-card__meta" aria-label="Room facts">
              <li>
                <Users size={16} aria-hidden="true" /> Up to {room.maxGuests} guests
              </li>
              <li>
                <BedDouble size={16} aria-hidden="true" /> {room.bedType}
              </li>
              <li>
                <Ruler size={16} aria-hidden="true" /> {room.sizeSqm} m²
              </li>
            </ul>
            {available && (
              <div className="room-card__price">
                <span className="room-card__total">
                  {formatMoney(totalPrice, currency)}
                </span>
                <span className="room-card__nights">
                  total · {nights} {nights === 1 ? "night" : " nights"}
                  <br />
                  incl. {taxesAndFees.map((t) => t.label).join(", ")}
                </span>
              </div>
            )}
            <div className="room-card__actions">
              {available ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => setSelected({ room, available, totalPrice, currency, nights, taxesAndFees })}
                >
                  Reserve this room
                </button>
              ) : (
                <button type="button" className="btn btn--ghost" disabled>
                  Not available
                </button>
              )}
              <Link to={`/stay/${room.slug}`} className="btn btn--ghost btn--sm">
                Room details
              </Link>
            </div>
          </div>
        </article>
      ))}
      {selected && (
        <BookingRequestModal
          selection={selected}
          query={query}
          onClose={() => setSelected(null)}
        />
      )}
      <Leaf aria-hidden="true" className="room-card__leaf" />
    </div>
  );
}
