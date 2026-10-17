import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import type { HotelBooking } from "../api/types";
import { formatDateLong, formatMoney } from "../utils/format";
import "./ManageBookingPage.css";

export default function ManageBookingPage() {
  const { state, run } = useAsync<HotelBooking>();
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");
  const [submitted, setSubmitted] = useState(false);

  function lookup(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    void run(() => api.getHotelBooking(reference.trim(), token.trim()));
  }

  async function cancel() {
    void run(() => api.cancelHotelBooking(reference.trim(), token.trim()));
  }

  const booking = state.kind === "done" ? state.data : null;

  return (
    <>
      <section className="page-head">
        <div className="container">
          <span className="eyebrow">Manage booking</span>
          <h1>Find or cancel your stay</h1>
          <p className="lede">
            Enter the booking reference from your confirmation email along with
            the secure link or code it contains. No account needed.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container manage-grid">
          <form className="card" onSubmit={lookup} aria-label="Booking lookup">
            <div className="field">
              <label htmlFor="mb-ref">Booking reference</label>
              <input
                id="mb-ref"
                className="input"
                placeholder="e.g. DRH-ABC123"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="mb-token">Secure code from your email</label>
              <input
                id="mb-token"
                className="input"
                type="password"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
            </div>
            {isMockMode && (
              <p className="badge badge--clay" role="note">
                Preview mode — lookup needs the real backend, which verifies
                references and secure codes.
              </p>
            )}
            {state.kind === "error" && (
              <p className="error-text" role="alert">
                {state.message}
              </p>
            )}
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={state.kind === "loading"}
            >
              <KeyRound size={17} aria-hidden="true" />
              {state.kind === "loading" ? "Looking…" : "Find my booking"}
            </button>
          </form>

          {booking && (
            <div className="card" aria-live="polite">
              <h3>Booking {booking.reference}</h3>
              <dl className="confirm-summary">
                <div>
                  <dt>Room</dt>
                  <dd>{booking.roomName}</dd>
                </div>
                <div>
                  <dt>Dates</dt>
                  <dd>
                    {formatDateLong(booking.checkIn)} →{" "}
                    {formatDateLong(booking.checkOut)}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd className="badge badge--sage">
                    {booking.status.replace("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt>Total</dt>
                  <dd>{formatMoney(booking.totalPrice, booking.currency)}</dd>
                </div>
              </dl>
              <p className="lede">
                <strong>Cancellation deadline:</strong>{" "}
                {formatDateLong(booking.cancellationDeadline)}
              </p>
              <p className="lede">{booking.refundPolicy}</p>
              {booking.status === "cancelled" ? (
                <p className="badge badge--clay">This booking is cancelled.</p>
              ) : (
                <button
                  type="button"
                  className="btn btn--sunset"
                  onClick={cancel}
                  disabled={state.kind === "loading"}
                >
                  {state.kind === "loading" ? "Cancelling…" : "Cancel this booking"}
                </button>
              )}
            </div>
          )}

          {state.kind === "idle" && !submitted && (
            <div className="card manage-hint">
              <h3>Where do I find these?</h3>
              <p className="lede">
                After booking you received a confirmation email containing your
                reference and a private, one-time secure link. The link — not
                just the reference — protects your booking from being viewed or
                cancelled by others. Links expire for your safety.
              </p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
