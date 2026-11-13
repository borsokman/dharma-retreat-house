import { useState } from "react";
import { ExternalLink, Info, MapPin, Star } from "lucide-react";
import { Lightbox } from "../components/Lightbox";
import { images } from "../data/images";
import { site } from "../data/site";
import "./CoffeeHousePage.css";

// The first photo is the large one beside the intro; the rest form the row.
const photos = [
  {
    src: images.coffeeHouse.exterior,
    alt: "The wooden front of Dharma Coffee House & Library",
  },
  {
    src: images.coffeeHouse.libraryCorner,
    alt: "Wicker armchairs in front of shelves of books and cups",
  },
  { src: images.coffeeHouse.coffee, alt: "A cappuccino with latte art" },
  {
    src: images.coffeeHouse.localDish,
    alt: "A plate of crispy, spicy stir-fried dish with salad",
  },
  {
    src: images.coffeeHouse.entrance,
    alt: "The café entrance with flower pots on the steps",
  },
];

function PhotoButton({
  index,
  className,
  onOpen,
  lazy = true,
}: {
  index: number;
  className: string;
  onOpen: (index: number) => void;
  lazy?: boolean;
}) {
  const photo = photos[index];
  return (
    <button
      type="button"
      className={`coffee-photo ${className}`}
      onClick={() => onOpen(index)}
      aria-label={`Enlarge photo: ${photo.alt}`}
    >
      <img
        src={photo.src}
        alt={photo.alt}
        width="960"
        height="720"
        loading={lazy ? "lazy" : undefined}
      />
    </button>
  );
}

export default function CoffeeHousePage() {
  const [openPhoto, setOpenPhoto] = useState<number | null>(null);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Our partner café</span>
          <h1>Dharma Coffee House &amp; Library</h1>
          <p className="lede">
            Coffee, tea, bakery, lunch and dinner — a 2-minute walk from the
            house.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container coffee-intro">
          <div>
            <h2>Coffee among the books</h2>
            <p className="lede">
              A cosy café and library where you can settle into a wicker
              armchair with artisanal coffee or tea, freshly baked treats or a
              full meal, surrounded by shelves of books — many of them about the
              region.
            </p>
            <p className="lede">
              Built with nature- and environment-friendly measures, it was the
              first café of its kind in Tawang. Dine in, take away, or sit
              outside on a clear mountain day.
            </p>
            <div className="coffee-links">
              <a
                className="btn btn--primary"
                href={site.coffeeHouse.mapUrl}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin size={18} aria-hidden="true" /> Get directions
              </a>
              <a
                className="btn btn--sunset"
                href={site.coffeeHouse.reviewsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Star size={18} aria-hidden="true" /> Google reviews
              </a>
              <a
                className="coffee-links__text"
                href={site.coffeeHouse.facebookUrl}
                target="_blank"
                rel="noreferrer"
              >
                Facebook <ExternalLink size={15} aria-hidden="true" />
              </a>
            </div>
          </div>
          <PhotoButton
            index={0}
            className="coffee-photo--large"
            onOpen={setOpenPhoto}
            lazy={false}
          />
        </div>

        <div className="container">
          <div className="coffee-photos">
            {photos.slice(1).map((photo, i) => (
              <PhotoButton
                key={photo.src}
                index={i + 1}
                className="coffee-photo--small"
                onOpen={setOpenPhoto}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="section section--sage" aria-labelledby="meals-title">
        <div className="container coffee-meals">
          <h2 id="meals-title">Meals during your stay</h2>
          <p className="lede">
            {site.name} serves a complimentary home-style breakfast every day.
            We don't offer lunch or dinner in-house.
          </p>
          <p className="lede">
            For lunch, dinner, artisanal coffee, tea and bakery items, you're
            welcome to visit our partner, Dharma Coffee House &amp; Library,
            just a 2-minute walk from the property.
          </p>
          <ul className="coffee-meals__list">
            <li>Visit the café directly to place and pay for your order.</li>
            <li>Dharma Coffee House operates independently.</li>
          </ul>
          <p className="coffee-notice">
            <Info size={18} aria-hidden="true" />
            <span>
              {site.name} accepts no liability, responsibility or guarantee
              regarding the services, orders, availability or operations of
              independent third-party dining establishments, including Dharma
              Coffee House.
            </span>
          </p>
        </div>
      </section>

      {openPhoto !== null && (
        <Lightbox
          label="Dharma Coffee House photos"
          images={photos}
          startIndex={openPhoto}
          onClose={() => setOpenPhoto(null)}
        />
      )}
    </>
  );
}
