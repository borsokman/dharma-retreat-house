import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BedDouble,
  Check,
  DoorOpen,
  Images,
  Ruler,
  Users,
} from "lucide-react";
import { rooms } from "../data/rooms";
import { policies } from "../data/site";
import type { RoomType } from "../api/types";
import { Lightbox } from "../components/Lightbox";
import { formatMoney } from "../utils/format";
import "./RoomsPage.css";

/** "Room Nos: 201, 203 & 208 — …" → "Rooms 201, 203 & 208" */
function roomNumbers(room: RoomType): string | null {
  const m = /^Room Nos?:\s*([^—]+?)\s*—/.exec(room.shortDescription);
  if (!m) return null;
  return `${/[,&]/.test(m[1]!) ? "Rooms" : "Room"} ${m[1]}`;
}

/**
 * All room types as wide one-column cards, photo and text side by side
 * (alternating sides on wide screens). Each card links to /book with that room
 * pre-selected. /stay#<slug> scrolls to one room (old /stay/<slug> links
 * redirect here).
 */
export default function RoomsPage() {
  const [gallery, setGallery] = useState<RoomType | null>(null);
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(decodeURIComponent(hash.slice(1)));
    el?.scrollIntoView({ block: "start" });
  }, [hash]);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Stay with us</span>
          <h1>Rooms &amp; Suites</h1>
          <p className="lede">
            Five room types, twelve rooms — every one quiet, warm and supporting
            the school's work. Breakfast is included, and cancellation is free
            up to 48 hours before check-in.
          </p>
          <Link to="/book" className="btn btn--primary">
            Check availability <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section stay-list-section">
        <div className="container stay-list">
          {rooms.map((room, i) => {
            const numbers = roomNumbers(room);
            return (
              <article
                key={room.slug}
                id={room.slug}
                className={`stay-card${i % 2 ? " stay-card--flip" : ""}`}
                aria-labelledby={`${room.slug}-title`}
              >
                <button
                  type="button"
                  className="stay-card__media"
                  onClick={() => setGallery(room)}
                  aria-label={`View photos of the ${room.name}`}
                >
                  <img
                    src={room.photos[0]}
                    alt=""
                    loading={i === 0 ? "eager" : "lazy"}
                    width="940"
                    height="650"
                  />
                  {numbers && (
                    <span className="stay-card__chip stay-card__chip--rooms">
                      <DoorOpen size={15} aria-hidden="true" /> {numbers}
                    </span>
                  )}
                  {room.photos.length > 1 && (
                    <span className="stay-card__chip stay-card__chip--photos">
                      <Images size={15} aria-hidden="true" />{" "}
                      {room.photos.length} photos
                    </span>
                  )}
                </button>

                <div className="stay-card__body">
                  <ul className="stay-card__meta" aria-label="Room facts">
                    <li>
                      <Users size={15} aria-hidden="true" /> Up to{" "}
                      {room.maxGuests} guests
                    </li>
                    <li>
                      <BedDouble size={15} aria-hidden="true" /> {room.bedType}
                    </li>
                    <li>
                      <Ruler size={15} aria-hidden="true" /> {room.sizeSqm} m²
                    </li>
                  </ul>
                  <h2 id={`${room.slug}-title`}>{room.name}</h2>
                  <p className="stay-card__desc">{room.description}</p>
                  <ul className="stay-card__amenities" aria-label="Amenities">
                    {room.amenities.map((a) => (
                      <li key={a}>
                        <Check size={16} aria-hidden="true" /> {a}
                      </li>
                    ))}
                  </ul>
                  <div className="stay-card__foot">
                    <p className="stay-card__price">
                      {formatMoney(room.basePrice, room.currency)}
                      <span> / night</span>
                    </p>
                    <div className="stay-card__actions">
                      <Link
                        to={`/book?room=${encodeURIComponent(room.slug)}`}
                        className="btn btn--primary"
                      >
                        Book this room{" "}
                        <ArrowRight size={18} aria-hidden="true" />
                      </Link>
                      <button
                        type="button"
                        className="btn btn--ghost"
                        onClick={() => setGallery(room)}
                      >
                        View photos
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
          <p className="stay-list__policy">
            {policies.checkIn} · {policies.checkOut}. Travelling with more
            people? Choose the number of rooms in the booking form.
          </p>
        </div>
      </section>

      {gallery && (
        <Lightbox
          label={`${gallery.name} photos`}
          images={gallery.photos.map((src, i) => ({
            src,
            alt: `${gallery.name} photo ${i + 1} of ${gallery.photos.length}`,
          }))}
          onClose={() => setGallery(null)}
          renderInfo={() => (
            <>
              <h3>{gallery.name}</h3>
              <p className="lede">{gallery.shortDescription}</p>
            </>
          )}
        />
      )}
    </>
  );
}
