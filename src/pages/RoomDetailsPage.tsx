import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BedDouble, Ruler, Users } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { useBookingSearch } from "../hooks/useBookingSearch";
import type { RoomAvailability, RoomType } from "../api/types";
import { Modal } from "../components/Modal";
import { BookingRequestModal } from "../components/BookingRequestModal";
import { formatMoney, todayISO } from "../utils/format";
import "./RoomDetailsPage.css";

export default function RoomDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { state: roomState, run: runRoom } = useAsync<RoomType | null>();
  const { state: availState, run: runAvail } = useAsync<RoomAvailability[]>();
  const { search } = useBookingSearch();
  const [dates, setDates] = useState({
    checkIn: search.checkIn || todayISO(1),
    checkOut: search.checkOut || todayISO(3),
  });
  const [guests, setGuests] = useState(search.guests);
  const [checking, setChecking] = useState(false);
  const [reserveOpen, setReserveOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slug) void runRoom(() => api.getRoom(slug));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function checkAvailability() {
    if (!slug || dates.checkOut <= dates.checkIn) return;
    setChecking(true);
    await runAvail(() =>
      api.getAvailability({
        checkIn: dates.checkIn,
        checkOut: dates.checkOut,
        guests,
        rooms: 1,
      }),
    );
    setChecking(false);
  }

  const availability = availState.kind === "done"
    ? availState.data.find((a) => a.room.slug === slug) ?? null
    : null;

  if (roomState.kind === "loading") {
    return (
      <div className="section container" role="status">
        <span className="spinner" aria-hidden="true" /> Loading room…
      </div>
    );
  }

  if (roomState.kind === "error" || (roomState.kind === "done" && !roomState.data)) {
    return (
      <div className="section container">
        <div className="card text-center" role="alert">
          <h2>Room not found</h2>
          <p className="lede">This room may have been renamed or removed.</p>
          <Link to="/stay" className="btn btn--primary">
            Back to all rooms
          </Link>
        </div>
      </div>
    );
  }

  const room = roomState.kind === "done" ? roomState.data : null;
  if (!room) return null;

  return (
    <>
      <section className="section container" style={{ paddingTop: "var(--space-6)" }}>
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

        <div
          className="room-gallery"
          role="group"
          aria-label={`${room.name} photo gallery — placeholder images`}
        >
          {room.photos.map((photo, i) => (
            <button
              key={i}
              type="button"
              className="room-gallery__item"
              onClick={() => setGalleryIndex(i)}
              aria-label={`Open photo ${i + 1} of ${room.photos.length}`}
            >
              <img src={photo} alt={`Placeholder — ${room.name} photo ${i + 1}`} loading="lazy" width="940" height="650" />
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
                onChange={(e) =>
                  setDates((d) => ({
                    checkIn: e.target.value,
                    checkOut: d.checkOut <= e.target.value ? "" : d.checkOut,
                  }))
                }
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
                onChange={(e) => setDates((d) => ({ ...d, checkOut: e.target.value }))}
              />
            </div>
            <div className="field">
              <label htmlFor="rd-guests">Guests</label>
              <select
                id="rd-guests"
                className="select"
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
              >
                {Array.from({ length: room.maxGuests }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--block"
              onClick={checkAvailability}
              disabled={checking || !dates.checkIn || !dates.checkOut || dates.checkOut <= dates.checkIn}
            >
              {checking ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Checking…
                </>
              ) : (
                "Check availability"
              )}
            </button>

            {availability && (
              <div className="room-details__result" role="status">
                {availability.available ? (
                  <>
                    <p className="room-details__price">
                      {formatMoney(availability.totalPrice, availability.currency)}
                    </p>
                    <p className="room-details__price-note">
                      total for {availability.nights}{" "}
                      {availability.nights === 1 ? "night" : "nights"}
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
                  <p className="error-text" role="status">
                    Not available for these dates — please try other dates or
                    another room.
                  </p>
                )}
              </div>
            )}
            <p className="room-details__policy">
              Free cancellation up to 48 hours before check-in. Check-in from
              14:00, check-out until 11:00.
            </p>
          </aside>
        </div>
      </section>

      {galleryIndex !== null && (
        <Modal title={`${room.name} — photo`} onClose={() => setGalleryIndex(null)}>
          <img
            src={room.photos[galleryIndex]}
            alt={`Placeholder — ${room.name} photo ${galleryIndex + 1}`}
            style={{ borderRadius: "var(--radius-md)", width: "100%" }}
          />
          <p className="lede text-center" style={{ marginTop: 8 }}>
            Placeholder image — a real photo of this room goes here.
          </p>
        </Modal>
      )}

      {reserveOpen && availability?.available && (
        <BookingRequestModal
          selection={availability}
          query={{
            checkIn: dates.checkIn,
            checkOut: dates.checkOut,
            guests,
            rooms: 1,
          }}
          onClose={() => setReserveOpen(false)}
        />
      )}
    </>
  );
}
