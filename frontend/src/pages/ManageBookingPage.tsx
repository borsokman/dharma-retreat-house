import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import type { HotelBooking } from "../api/types";
import {
  formatDateLong,
  formatMoney,
  formatStatus,
  pluralize,
} from "../utils/format";
import "../styles/forms.css";
import "./ManageBookingPage.css";

export default function ManageBookingPage() {
  const lookupAsync = useAsync<HotelBooking>();
  const cancelAsync = useAsync<HotelBooking>();
  const [reference, setReference] = useState("");
  const [token, setToken] = useState("");

  const lookupState = lookupAsync.state;
  const cancelState = cancelAsync.state;

  function lookup(e: FormEvent) {
    e.preventDefault();
    cancelAsync.reset();
    void lookupAsync.run(() =>
      api.getHotelBooking(reference.trim(), token.trim()),
    );
  }

  function cancel() {
    void cancelAsync.run(() =>
      api.cancelHotelBooking(reference.trim(), token.trim()),
    );
  }

  // After a successful cancellation, show the updated booking.
  const booking =
    cancelState.kind === "done"
      ? cancelState.data
      : lookupState.kind === "done"
        ? lookupState.data
        : null;
  const cancelling = cancelState.kind === "loading";

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
            {lookupState.kind === "error" && (
              <p className="error-text" role="alert">
                {lookupState.message}
              </p>
            )}
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={lookupState.kind === "loading"}
            >
              <KeyRound size={17} aria-hidden="true" />
              {lookupState.kind === "loading" ? "Looking…" : "Find my booking"}
            </button>
          </form>

          {booking && (
            <div className="card" aria-live="polite">
              <h3>Booking {booking.reference}</h3>
              <dl className="confirm-summary">
                {booking.rooms.map((room, i) => (
                  <div key={i}>
                    <dt>
                      {booking.rooms.length > 1 ? `Room ${i + 1}` : "Room"}
                    </dt>
                    <dd>
                      {room.roomName} · {pluralize(room.guests, "guest")}
                    </dd>
                  </div>
                ))}
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
                    {formatStatus(booking.status)}
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
              {cancelState.kind === "error" && (
                <p className="error-text" role="alert">
                  {cancelState.message}
                </p>
              )}
              {booking.status === "cancelled" ? (
                <p className="badge badge--clay">This booking is cancelled.</p>
              ) : (
                <button
                  type="button"
                  className="btn btn--sunset"
                  onClick={cancel}
                  disabled={cancelling}
                >
                  {cancelling ? "Cancelling…" : "Cancel this booking"}
                </button>
              )}
            </div>
          )}

          {lookupState.kind === "idle" && (
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
