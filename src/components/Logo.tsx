import { Link } from "react-router-dom";

export function Logo({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const color = variant === "light" ? "#F9F6F0" : "#2C2416";
  return (
    <Link
      to="/"
      aria-label="Dharma Retreat House — home"
      style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
    >
      <svg
        width="34"
        height="34"
        viewBox="0 0 34 34"
        aria-hidden="true"
        focusable="false"
      >
        {/* Organic leaf mark */}
        <path
          d="M17 2C24 6 30 12 29 20c-1 8-7 12-12 12S6 28 5 20C4 12 10 6 17 2Z"
          fill="#2D5A3D"
        />
        <path
          d="M17 6c-4 4-7 9-6.5 14S14 27 17 28c3-1 6-3 6.5-8S21 10 17 6Z"
          fill="#E8EDE5"
        />
      </svg>
      <span
        style={{
          fontFamily: "var(--font-serif)",
          fontWeight: 700,
          fontSize: "1.25rem",
          color,
          lineHeight: 1.15,
        }}
      >
        Dharma Retreat House
      </span>
    </Link>
  );
}
