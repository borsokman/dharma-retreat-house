import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { rooms } from "../data/rooms";
import type { RoomType } from "../api/types";
import { Lightbox } from "../components/Lightbox";
import { formatMoney } from "../utils/format";
import "./RoomsPage.css";

export default function RoomsPage() {
  const [openRoom, setOpenRoom] = useState<RoomType | null>(null);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Stay with us</span>
          <h1>Rooms &amp; Suites</h1>
          <p className="lede">
            Five room types to choose from — every one quiet, warm and
            supporting the school's work. Tap a room to see its photos.
          </p>
          <Link to="/book" className="btn btn--sunset">
            Check availability <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="section" style={{ paddingTop: "var(--space-4)" }}>
        <div className="container">
          <div className="room-grid">
            {rooms.map((room) => (
              <article key={room.slug} className="room-tile card card--hover">
                <button
                  type="button"
                  className="room-tile__img"
                  onClick={() => setOpenRoom(room)}
                  aria-label={`View photos of ${room.name}`}
                >
                  <img
                    src={room.photos[0]}
                    alt={room.name}
                    loading="lazy"
                    width="940"
                    height="650"
                  />
                </button>
                <Link to={`/stay/${room.slug}`} className="room-tile__body">
                  <h3>{room.name}</h3>
                  <p className="lede">{room.shortDescription}</p>
                  <p className="room-tile__price">
                    from {formatMoney(room.basePrice, room.currency)} / night
                  </p>
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      {openRoom && (
        <Lightbox
          label={`${openRoom.name} photos`}
          images={openRoom.photos.map((src, i) => ({
            src,
            alt: `${openRoom.name} photo ${i + 1} of ${openRoom.photos.length}`,
          }))}
          onClose={() => setOpenRoom(null)}
          renderInfo={() => (
            <>
              <h3>{openRoom.name}</h3>
              <p className="lede">{openRoom.shortDescription}</p>
            </>
          )}
        />
      )}
    </>
  );
}
