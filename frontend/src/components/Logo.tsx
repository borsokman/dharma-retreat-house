import { Link } from "react-router-dom";

const iconUrl = `${import.meta.env.BASE_URL}homepage-icon.svg`;

const textColors = {
  dark: "var(--text)",
  light: "#F9F6F0",
  footer: "var(--footer-text)",
};

export function Logo({
  variant = "dark",
}: {
  variant?: keyof typeof textColors;
}) {
  const color = textColors[variant];
  return (
    <Link
      to="/"
      aria-label="Dharma Retreat House — home"
      style={{ display: "inline-flex", alignItems: "center", gap: 10 }}
    >
      <img
        src={iconUrl}
        alt=""
        width={70}
        height={70}
        aria-hidden="true"
        style={{ flexShrink: 0 }}
      />
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
