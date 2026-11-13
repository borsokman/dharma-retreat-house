import { StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, useLocation, useNavigationType } from "react-router-dom";
import App from "./App";
import "./styles/global.css";

window.history.scrollRestoration = "manual";

function readScroll(key: string): number {
  try {
    return Number(sessionStorage.getItem(key)) || 0;
  } catch {
    return 0;
  }
}

function writeScroll(key: string, y: number) {
  try {
    sessionStorage.setItem(key, String(y));
  } catch {
    // Storage unavailable — scroll restoration simply won't persist.
  }
}

/**
 * New navigations start at the top; back/forward (and reloads) restore the
 * position that history entry was left at.
 */
function ScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const storageKey = `scroll-position:${location.key}`;

  useLayoutEffect(() => {
    let restoreFrame = 0;
    if (!location.hash) {
      const top = navigationType === "POP" ? readScroll(storageKey) : 0;
      const scroll = () => window.scrollTo({ top, behavior: "instant" });
      scroll();
      // Retry once after layout settles, in case content was still growing.
      restoreFrame = window.requestAnimationFrame(scroll);
    }

    // Throttled save. The last position is captured at scroll time, so the
    // flush on navigation never reads a value clamped by the next page.
    let lastY = window.scrollY;
    let saveTimer = 0;
    const flush = () => {
      window.clearTimeout(saveTimer);
      saveTimer = 0;
      writeScroll(storageKey, lastY);
    };
    const onScroll = () => {
      lastY = window.scrollY;
      if (!saveTimer) saveTimer = window.setTimeout(flush, 150);
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(restoreFrame);
      window.removeEventListener("scroll", onScroll);
      if (saveTimer) flush();
    };
  }, [storageKey, navigationType, location.hash]);

  return null;
}

const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ScrollManager />
      <App />
    </BrowserRouter>
  </StrictMode>,
);
