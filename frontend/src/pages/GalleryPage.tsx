import { useState } from "react";
import { images } from "../data/images";
import { Lightbox } from "../components/Lightbox";
import "./GalleryPage.css";

const galleryItems = (
  [
    { key: "monastery", label: "Nearby monastery" },
    { key: "stupa", label: "Stupa with prayer flags" },
    { key: "prayerFlags", label: "Prayer flags" },
    { key: "himalayaSunrise", label: "Himalayan sunrise" },
    { key: "himalayaMist", label: "Mountain mist" },
    { key: "goldenHour", label: "Golden hour peaks" },
    { key: "gardenPath", label: "Garden path" },
    { key: "gardenFlowers", label: "Wildflowers" },
    { key: "gardenStone", label: "Stone garden" },
  ] as const
).map((item) => ({
  ...item,
  src: images.gallery[item.key],
  alt: `Placeholder — here should be an image of ${item.label}`,
}));

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
                  src={item.src}
                  alt={item.alt}
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
        <Lightbox
          label="Gallery"
          images={galleryItems}
          startIndex={lightbox}
          onClose={() => setLightbox(null)}
          renderInfo={(i) => <h3>{galleryItems[i].label}</h3>}
        />
      )}
    </>
  );
}
