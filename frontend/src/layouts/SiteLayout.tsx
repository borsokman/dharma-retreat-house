import { Outlet, useOutletContext } from "react-router-dom";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { useTheme, type Theme } from "../hooks/useTheme";

interface SiteLayoutContext {
  theme: Theme;
}

/** Current theme for pages rendered inside SiteLayout. */
export function useSiteTheme(): Theme {
  return useOutletContext<SiteLayoutContext>().theme;
}

export function SiteLayout() {
  const { theme, toggle } = useTheme();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <Navbar theme={theme} onToggleTheme={toggle} />
      <main id="main">
        <Outlet context={{ theme } satisfies SiteLayoutContext} />
      </main>
      <Footer />
    </>
  );
}
