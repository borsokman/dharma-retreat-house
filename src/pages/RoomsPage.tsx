import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { rooms } from "../data/rooms";
import type { RoomType } from "../api/types";
import { formatMoney } from "../utils/format";
import "./RoomsPage.css";

export default function RoomsPage() {
  const [openRoom, setOpenRoom] = useState<RoomType | null>(null);
  const [index, setIndex] = useState(0);

  const close = useCallback(() => setOpenRoom(null), []);

  useEffect(() => {
    if (!openRoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + openRoom.photos.length) % openRoom.photos.length);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % openRoom.photos.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openRoom, close]);

  function open(room: RoomType) {
    setOpenRoom(room);
    setIndex(0);
  }

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Stay with us</span>
          <h1>Rooms &amp; suites</h1>
          <p className="lede">
            Five room types to choose from — every one quiet, warm and supporting
            the school's work. Tap a room to see its photos.
          </p>
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
                  onClick={() => open(room)}
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
        <div
          className="lightbox__backdrop"
          role="dialog"
          aria-modal="true"
          aria-label={`${openRoom.name} photos`}
          onClick={close}
        >
          <button
            type="button"
            className="lightbox__close"
            onClick={close}
            aria-label="Close photo gallery"
          >
            <X size={24} />
          </button>
          <div className="lightbox" onClick={(e) => e.stopPropagation()}>
            <div className="lightbox__stage">
              <img
                src={openRoom.photos[index]}
                alt={`${openRoom.name} photo ${index + 1} of ${openRoom.photos.length}`}
              />
              {openRoom.photos.length > 1 && (
                <>
                  <button
                    type="button"
                    className="lightbox__nav lightbox__nav--prev"
                    onClick={() =>
                      setIndex((i) => (i - 1 + openRoom.photos.length) % openRoom.photos.length)
                    }
                    aria-label="Previous photo"
                  >
                    <ChevronLeft size={28} />
                  </button>
                  <button
                    type="button"
                    className="lightbox__nav lightbox__nav--next"
                    onClick={() => setIndex((i) => (i + 1) % openRoom.photos.length)}
                    aria-label="Next photo"
                  >
                    <ChevronRight size={28} />
                  </button>
                </>
              )}
            </div>
            <div className="lightbox__info">
              <h3>{openRoom.name}</h3>
              <p className="lede">{openRoom.shortDescription}</p>
              <p className="lightbox__count">
                Photo {index + 1} of {openRoom.photos.length}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
