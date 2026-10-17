import { useState } from "react";
import { images } from "../data/images";

const galleryItems = [
  { key: "monastery", label: "Nearby monastery" },
  { key: "stupa", label: "Stupa with prayer flags" },
  { key: "prayerFlags", label: "Prayer flags" },
  { key: "himalayaSunrise", label: "Himalayan sunrise" },
  { key: "himalayaMist", label: "Mountain mist" },
  { key: "goldenHour", label: "Golden hour peaks" },
  { key: "gardenPath", label: "Garden path" },
  { key: "gardenFlowers", label: "Wildflowers" },
  { key: "gardenStone", label: "Stone garden" },
] as const;

export default function GalleryPage() {
  const [lightbox, setLightbox] = useState<number | null>(null);

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Gallery</span>
          <h1>Moments from the house</h1>
          <p className="lede">
            A glimpse of the house, its garden and the landscape around it.
            [Replace with the hotel's own photography.]
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="gallery-grid">
            {galleryItems.map((item, i) => (
              <button
                key={item.key}
                type="button"
                className="gallery-item"
                onClick={() => setLightbox(i)}
                aria-label={`Open image: ${item.label}`}
              >
                <img
                  src={images.gallery[item.key]}
                  alt={`Placeholder — here should be an image of ${item.label}`}
                  loading="lazy"
                  width="940"
                  height="650"
                />
                <span className="gallery-item__label">{item.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {lightbox !== null && (
        <div
          className="gallery-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label={galleryItems[lightbox].label}
          onClick={() => setLightbox(null)}
        >
          <figure onClick={(e) => e.stopPropagation()}>
            <img
              src={images.gallery[galleryItems[lightbox].key]}
              alt={`Placeholder — here should be an image of ${galleryItems[lightbox].label}`}
            />
            <figcaption>{galleryItems[lightbox].label}</figcaption>
            <button
              type="button"
              className="gallery-lightbox__close"
              onClick={() => setLightbox(null)}
            >
              Close
            </button>
          </figure>
        </div>
      )}
    </>
  );
}
