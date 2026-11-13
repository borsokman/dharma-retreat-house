import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, Ruler, Users } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useBookingSearch } from "../hooks/useBookingSearch";
import type { AvailabilityQuery, RoomAvailability, RoomType } from "../api/types";
import { Lightbox } from "../components/Lightbox";
import { BookingRequestModal } from "../components/BookingRequestModal";
import { policies } from "../data/site";
import { formatMoney, pluralize, range, todayISO } from "../utils/format";
import "./RoomDetailsPage.css";

export default function RoomDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { state: roomState, run: runRoom } = useAsync<RoomType | null>();
  const {
    state: availState,
    run: runAvail,
    reset: resetAvail,
  } = useAsync<RoomAvailability[]>();
  const { search } = useBookingSearch();
  const [dates, setDates] = useState({
    checkIn: search.checkIn || todayISO(1),
    checkOut: search.checkOut || todayISO(3),
  });
  const [guests, setGuests] = useState(search.guests);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slug) void runRoom(() => api.getRoom(slug));
    resetAvail();
  }, [slug, runRoom, resetAvail]);

  const room = roomState.kind === "done" ? roomState.data : null;
  // The search widget allows more guests than a single room may hold.
  const guestCount = room ? Math.min(guests, room.maxGuests) : guests;
  const query: AvailabilityQuery = { ...dates, guests: guestCount, rooms: 1 };
  const datesValid = !!dates.checkIn && dates.checkOut > dates.checkIn;
  const checking = availState.kind === "loading";

  function checkAvailability() {
    if (!datesValid) return;
    void runAvail(() => api.getAvailability(query));
  }

  /** Any change to the search invalidates the previously shown price. */
  function changeSearch(apply: () => void) {
    apply();
    resetAvail();
  }

  const availability =
    availState.kind === "done"
      ? (availState.data.find((a) => a.room.slug === slug) ?? null)
      : null;

  if (roomState.kind === "idle" || roomState.kind === "loading") {
    return (
      <section className="page-head">
        <div className="container" role="status">
          <span className="spinner" aria-hidden="true" /> Loading room…
        </div>
      </section>
    );
  }

  if (!room) {
    return (
      <section className="page-head">
        <div className="container">
          <div className="card text-center" role="alert">
            <h2>Room not found</h2>
            <p className="lede">This room may have been renamed or removed.</p>
            <Link to="/stay" className="btn btn--primary">
              Back to all rooms
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const photoAlt = (i: number) => `${room.name} — photo ${i + 1}`;

  return (
    <>
      <section className="page-head">
        <div className="container">
          <Link to="/stay" className="room-details__back">
            <ArrowLeft size={16} aria-hidden="true" /> All rooms
          </Link>
          {isMockMode && (
            <p className="badge badge--clay" role="note" style={{ marginTop: 8 }}>
              Preview mode — availability and prices are simulated
            </p>
          )}
          <h1 className="mt-2">{room.name}</h1>
          <p className="lede" style={{ maxWidth: 640 }}>{room.shortDescription}</p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--space-4)" }}>
        <div className="container">
          <div
            className="room-gallery"
            role="group"
            aria-label={`${room.name} photo gallery`}
          >
            {room.photos.map((photo, i) => (
              <button
                key={photo + i}
                type="button"
                className="room-gallery__item"
                onClick={() => setGalleryIndex(i)}
                aria-label={`Open photo ${i + 1} of ${room.photos.length}`}
              >
                <img
                  src={photo}
                  alt={photoAlt(i)}
                  loading="lazy"
                  width="940"
                  height="650"
                />
              </button>
            ))}
          </div>

          <div className="room-details__grid">
            <div className="card">
              <h3>About this room</h3>
              <p className="lede">{room.description}</p>
              <ul className="room-details__facts" aria-label="Room facts">
                <li><Users size={17} aria-hidden="true" /> Up to {room.maxGuests} guests</li>
                <li><BedDouble size={17} aria-hidden="true" /> {room.bedType}</li>
                <li><Ruler size={17} aria-hidden="true" /> {room.sizeSqm} m²</li>
              </ul>
              <h3 className="mt-2">Amenities</h3>
              <ul className="room-details__amenities">
                {room.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            <aside className="card room-details__booking" aria-label="Check availability and book">
              <h3>Check availability</h3>
              <div className="field">
                <label htmlFor="rd-checkin">Check-in</label>
                <input
                  id="rd-checkin"
                  className="input"
                  type="date"
                  min={todayISO()}
                  value={dates.checkIn}
                  onChange={(e) => {
                    const checkIn = e.target.value;
                    changeSearch(() =>
                      setDates((d) => ({
                        checkIn,
                        checkOut: d.checkOut > checkIn ? d.checkOut : "",
                      })),
                    );
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="rd-checkout">Check-out</label>
                <input
                  id="rd-checkout"
                  className="input"
                  type="date"
                  min={dates.checkIn || todayISO()}
                  value={dates.checkOut}
                  onChange={(e) => {
                    const checkOut = e.target.value;
                    changeSearch(() => setDates((d) => ({ ...d, checkOut })));
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="rd-guests">Guests</label>
                <select
                  id="rd-guests"
                  className="select"
                  value={guestCount}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    changeSearch(() => setGuests(n));
                  }}
                >
                  {range(room.maxGuests).map((n) => (
                    <option key={n} value={n}>
                      {pluralize(n, "guest")}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="btn btn--primary btn--block"
                onClick={checkAvailability}
                disabled={checking || !datesValid}
              >
                {checking ? (
                  <>
                    <span className="spinner" aria-hidden="true" /> Checking…
                  </>
                ) : (
                  "Check availability"
                )}
              </button>

              {availState.kind === "error" && (
                <p className="error-text" role="alert">
                  {availState.message}
                </p>
              )}

              {availability && (
                <div className="room-details__result" role="status">
                  {availability.available ? (
                    <>
                      <p className="room-details__price">
                        {formatMoney(availability.totalPrice, availability.currency)}
                      </p>
                      <p className="room-details__price-note">
                        total for {pluralize(availability.nights, "night")}
                        {availability.taxesAndFees.length > 0 &&
                          ` · incl. ${availability.taxesAndFees
                            .map((t) => `${t.label} ${formatMoney(t.amount, availability.currency)}`)
                            .join(", ")}`}
                      </p>
                      <button
                        type="button"
                        className="btn btn--sunset btn--block"
                        onClick={() => setReserveOpen(true)}
                      >
                        Reserve this room
                      </button>
                    </>
                  ) : (
                    <p className="error-text">
                      Not available for these dates — please try other dates or
                      another room.
                    </p>
                  )}
                </div>
              )}
              <p className="room-details__policy">
                Free cancellation up to 48 hours before check-in.{" "}
                {policies.checkIn}, {policies.checkOut.toLowerCase()}.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {galleryIndex !== null && (
        <Lightbox
          label={`${room.name} photos`}
          images={room.photos.map((src, i) => ({ src, alt: photoAlt(i) }))}
          startIndex={galleryIndex}
          onClose={() => setGalleryIndex(null)}
          renderInfo={() => <h3>{room.name}</h3>}
        />
      )}

      {reserveOpen && availability?.available && (
        <BookingRequestModal
          selection={availability}
          query={query}
          onClose={() => setReserveOpen(false)}
        />
      )}
    </>
  );
}
