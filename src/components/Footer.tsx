import { Link } from "react-router-dom";
import { Mail, MapPin, Phone } from "lucide-react";
import { navLinks, policies, site } from "../data/site";
import { Logo } from "./Logo";
import "./Footer.css";

export function Footer() {
  return (
    <footer className="footer">
      <svg
        className="wave-divider"
        viewBox="0 0 1440 56"
        preserveAspectRatio="none"
        aria-hidden="true"
        style={{ background: "var(--forest-deep)" }}
      >
        <path
          d="M0,32 C240,56 480,8 720,24 C960,40 1200,8 1440,28 L1440,56 L0,56 Z"
          fill="var(--cream)"
        />
      </svg>
      <div className="footer__body">
        <div className="container footer__grid">
          <div>
            <Logo variant="light" />
            <p className="footer__note">{site.charityNote}</p>
          </div>
          <nav aria-label="Footer navigation">
            <h3 className="footer__heading">Explore</h3>
            {navLinks.map((l) => (
              <Link key={l.to} to={l.to} className="footer__link">
                {l.label}
              </Link>
            ))}
            <Link to="/manage-booking" className="footer__link">
              Manage booking
            </Link>
          </nav>
          <div>
            <h3 className="footer__heading">Contact</h3>
            <p className="footer__line">
              <MapPin size={16} aria-hidden="true" />{" "}
              {site.addressLines.join(", ")}
            </p>
            <p className="footer__line">
              <Mail size={16} aria-hidden="true" /> {site.email}
            </p>
            <p className="footer__line">
              <Phone size={16} aria-hidden="true" /> {site.phone}
            </p>
          </div>
          <div>
            <h3 className="footer__heading">Good to know</h3>
            <p className="footer__line">{policies.checkIn}</p>
            <p className="footer__line">{policies.checkOut}</p>
            <Link to="/contact" className="footer__link">
              Policies & directions
            </Link>
          </div>
        </div>
        <div className="container footer__bottom">
          <p>
            © {new Date().getFullYear()} {site.name}. All proceeds support{" "}
            {site.charityName}.
          </p>
        </div>
      </div>
    </footer>
  );
}
