import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

// Keep in sync with the inline theme script in index.html.
const STORAGE_KEY = "dharma-theme";

function getInitialTheme(): Theme {
  const applied = document.documentElement.getAttribute("data-theme");
  if (applied === "light" || applied === "dark") return applied;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.style.colorScheme = theme;
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((t) => {
      const next = t === "light" ? "dark" : "light";
      // Only an explicit choice is remembered; otherwise the OS setting wins.
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Storage can be unavailable (private mode, blocked cookies).
      }
      return next;
    });
  }, []);

  return { theme, toggle };
}
