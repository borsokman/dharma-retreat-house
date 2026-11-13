import { useEffect, useLayoutEffect, useRef } from "react";

/**
 * Shared dialog behaviour: closes on Escape, locks page scroll, moves focus
 * into the dialog and returns it to the opener on close. Attach the returned
 * ref to the dialog element (give it tabIndex={-1}).
 *
 * Handlers are read through a ref, so callers can pass inline functions
 * without re-running the effect on every render.
 */
export function useDialog<T extends HTMLElement>(
  onClose: () => void,
  onKeyDown?: (e: KeyboardEvent) => void,
) {
  const ref = useRef<T>(null);
  const handlers = useRef({ onClose, onKeyDown });

  useLayoutEffect(() => {
    handlers.current = { onClose, onKeyDown };
  });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    ref.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handlers.current.onClose();
      else handlers.current.onKeyDown?.(e);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus?.();
    };
  }, []);

  return ref;
}
