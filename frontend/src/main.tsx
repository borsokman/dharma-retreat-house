import { StrictMode, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  useLocation,
  useNavigationType,
} from "react-router-dom";
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

/** Fades out the loading screen from index.html once the app is on screen. */
function hideBootScreen() {
  const boot = document.getElementById("boot");
  if (!boot) return;
  boot.classList.add("boot--done");
  const remove = () => boot.remove();
  boot.addEventListener("transitionend", remove, { once: true });
  window.setTimeout(remove, 600); // reduced motion: no transition event
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ScrollManager />
      <App />
    </BrowserRouter>
  </StrictMode>,
);

// Wait until the first render is painted and, on the homepage, until the
// hero photo has arrived (at most 3 s), so the fade never reveals a blank hero.
requestAnimationFrame(() =>
  requestAnimationFrame(() => {
    const hero = document.querySelector<HTMLImageElement>(".hero__img");
    if (!hero || hero.complete) return hideBootScreen();
    const timer = window.setTimeout(hideBootScreen, 3000);
    const done = () => {
      window.clearTimeout(timer);
      hideBootScreen();
    };
    hero.addEventListener("load", done, { once: true });
    hero.addEventListener("error", done, { once: true });
  }),
);
