import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="section container text-center" style={{ paddingTop: "var(--space-8)" }}>
      <h1>Page not found</h1>
      <p className="lede" style={{ maxWidth: 480, margin: "0 auto 24px" }}>
        The path you followed doesn't exist — perhaps an old link. The house,
        however, is exactly where it always is.
      </p>
      <Link to="/" className="btn btn--primary">
        Back to the homepage
      </Link>
    </section>
  );
}
