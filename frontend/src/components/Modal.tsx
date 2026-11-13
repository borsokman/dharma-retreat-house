import { type ReactNode } from "react";
import { X } from "lucide-react";
import { useDialog } from "../hooks/useDialog";
import "./Modal.css";
import "../styles/forms.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, onClose, children }: ModalProps) {
  const dialogRef = useDialog<HTMLDivElement>(onClose);

  return (
    <div className="modal__backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal__head">
          <h3>{title}</h3>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
