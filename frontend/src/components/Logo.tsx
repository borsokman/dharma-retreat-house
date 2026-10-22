import { Link } from "react-router-dom";
import "./Logo.css";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  return (
    <Link
      to="/"
      className={`brand-logo brand-logo--${variant}`}
      aria-label="Dharma Retreat House — home"
    >
      <img src="/logo.jpg" alt="Dharma Retreat House" />
    </Link>
  );
}
