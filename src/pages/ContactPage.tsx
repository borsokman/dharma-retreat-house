import { useState, type FormEvent } from "react";
import { CheckCircle2, Mail, MapPin, Phone } from "lucide-react";
import { policies, site } from "../data/site";
import "./ContactPage.css";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  function submit(e: FormEvent) {
    e.preventDefault();
    // No backend yet — this form is a placeholder for the contact endpoint.
    setSent(true);
  }

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Contact</span>
          <h1>We'd love to hear from you</h1>
          <p className="lede">
            Questions about a stay, the restaurant or the school — write, call
            or visit.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container contact-grid">
          <div className="card">
            <h3>Reach us</h3>
            <p className="contact-line">
              <MapPin size={18} aria-hidden="true" />
              <span>
                {site.addressLines.map((line) => (
                  <span key={line}>
                    {line}
                    <br />
                  </span>
                ))}
              </span>
            </p>
            <p className="contact-line">
              <Mail size={18} aria-hidden="true" />{" "}
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
            <p className="contact-line">
              <Phone size={18} aria-hidden="true" />{" "}
              <a href={`tel:${site.phone.replace(/\s/g, "")}`}>{site.phone}</a>
            </p>

            <h3 className="mt-2">Directions</h3>
            <p className="lede">
              [Add directions here: nearest town, transport options, parking.]
            </p>
            {site.mapEmbedUrl ? (
              <iframe
                src={site.mapEmbedUrl}
                title="Map to Dharma Retreat House"
                className="contact-map"
                loading="lazy"
              />
            ) : (
              <div className="contact-map contact-map--placeholder" aria-label="Map placeholder">
                Map placeholder — embed the property's location here.
              </div>
            )}

            <h3 className="mt-2">Policies</h3>
            <p className="lede">
              <strong>Cancellation:</strong> {policies.cancellation}
            </p>
            <p className="lede">
              {policies.checkIn} · {policies.checkOut}
            </p>
            <p className="lede">
              <strong>Restaurant:</strong> {policies.restaurantCancellation}
            </p>
          </div>

          <div className="card">
            <h3>Send a message</h3>
            {sent ? (
              <div className="text-center" role="status">
                <CheckCircle2 size={44} color="var(--forest)" aria-hidden="true" />
                <p className="lede mt-2">
                  Thank you — your message has been noted. (Once the backend is
                  connected, this form will email the house directly.)
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <div className="field">
                  <label htmlFor="ct-name">Name</label>
                  <input
                    id="ct-name"
                    className="input"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ct-email">Email</label>
                  <input
                    id="ct-email"
                    className="input"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ct-message">Message</label>
                  <textarea
                    id="ct-message"
                    className="input"
                    rows={5}
                    required
                    value={form.message}
                    onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  />
                </div>
                <button type="submit" className="btn btn--primary btn--block">
                  Send message
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
