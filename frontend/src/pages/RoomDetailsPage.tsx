import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BedDouble, Ruler, Users } from "lucide-react";
import { api } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import type { RoomType } from "../api/types";
import { Lightbox } from "../components/Lightbox";
import { policies } from "../data/site";
import { formatMoney } from "../utils/format";
import "./RoomDetailsPage.css";

export default function RoomDetailsPage() {
  const { slug } = useParams<{ slug: string }>();
  const { state: roomState, run: runRoom } = useAsync<RoomType | null>();
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);

  useEffect(() => {
    if (slug) void runRoom(() => api.getRoom(slug));
  }, [slug, runRoom]);

  const room = roomState.kind === "done" ? roomState.data : null;

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
          <h1 className="mt-2">{room.name}</h1>
          <p className="lede" style={{ maxWidth: 640 }}>
            {room.shortDescription}
          </p>
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
                <li>
                  <Users size={17} aria-hidden="true" /> Up to {room.maxGuests}{" "}
                  guests
                </li>
                <li>
                  <BedDouble size={17} aria-hidden="true" /> {room.bedType}
                </li>
                <li>
                  <Ruler size={17} aria-hidden="true" /> {room.sizeSqm} m²
                </li>
              </ul>
              <h3 className="mt-2">Amenities</h3>
              <ul className="room-details__amenities">
                {room.amenities.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>

            <aside
              className="card room-details__booking"
              aria-label="Book this room"
            >
              <h3>Stay in the {room.name}</h3>
              <p className="room-details__price">
                {formatMoney(room.basePrice, room.currency)}
                <span> / night</span>
              </p>
              <p className="room-details__price-note">
                Up to {room.maxGuests} guests · breakfast included
              </p>
              <Link
                to={`/book?room=${encodeURIComponent(room.slug)}`}
                className="btn btn--sunset btn--block"
              >
                Book this room <ArrowRight size={18} aria-hidden="true" />
              </Link>
              <p className="room-details__policy">
                Travelling with more people? Choose the number of rooms on the
                next step. Free cancellation up to 48 hours before check-in.{" "}
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
    </>
  );
}
