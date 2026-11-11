import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useDialog } from "../hooks/useDialog";
import "./Lightbox.css";

export interface LightboxImage {
  src: string;
  alt: string;
}

interface LightboxProps {
  /** Accessible name of the dialog. */
  label: string;
  images: LightboxImage[];
  startIndex?: number;
  onClose: () => void;
  /** Caption content for the photo currently shown. */
  renderInfo?: (index: number) => ReactNode;
}

export function Lightbox({
  label,
  images,
  startIndex = 0,
  onClose,
  renderInfo,
}: LightboxProps) {
  const [index, setIndex] = useState(startIndex);
  const count = images.length;
  const step = (delta: number) => setIndex((i) => (i + delta + count) % count);

  const dialogRef = useDialog<HTMLDivElement>(onClose, (e) => {
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
  });

  const image = images[index];

  return (
    <div
      ref={dialogRef}
      className="lightbox__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      onClick={onClose}
    >
      <button
        type="button"
        className="lightbox__close"
        onClick={onClose}
        aria-label="Close photo viewer"
      >
        <X size={24} />
      </button>
      <div className="lightbox" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox__stage">
          <img key={index} src={image.src} alt={image.alt} />
          {count > 1 && (
            <>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--prev"
                onClick={() => step(-1)}
                aria-label="Previous photo"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                type="button"
                className="lightbox__nav lightbox__nav--next"
                onClick={() => step(1)}
                aria-label="Next photo"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
        </div>
        <div className="lightbox__info">
          {renderInfo?.(index)}
          {count > 1 && (
            <p className="lightbox__count">
              Photo {index + 1} of {count}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
