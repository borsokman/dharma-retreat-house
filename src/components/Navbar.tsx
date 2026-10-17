import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { navLinks } from "../data/site";
import { Logo } from "./Logo";
import "./Navbar.css";

export function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const onHero = location.pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className={`nav ${onHero ? "nav--overlay" : ""}`}>
      <div className="nav__inner container">
        <Logo variant={onHero ? "light" : "dark"} />
        <nav aria-label="Main navigation" className="nav__links">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) =>
                `nav__link ${isActive ? "nav__link--active" : ""}`
              }
            >
              {link.label}
            </NavLink>
          ))}
          <Link to="/stay" className="btn btn--sunset btn--sm">
            Book Now
          </Link>
        </nav>
        <button
          type="button"
          className="nav__toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>
      {open && (
        <div id="mobile-menu" className="nav__mobile">
          <nav aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/"}
                className={({ isActive }) =>
                  `nav__mobile-link ${isActive ? "nav__mobile-link--active" : ""}`
                }
              >
                {link.label}
              </NavLink>
            ))}
            <Link to="/stay" className="btn btn--primary btn--block">
              Book Now
            </Link>
            <Link to="/staff" className="nav__staff-link">
              Staff area
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
