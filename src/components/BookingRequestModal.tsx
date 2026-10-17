import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import type {
  AvailabilityQuery,
  HotelBooking,
  RoomAvailability,
} from "../api/types";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Modal } from "./Modal";
import { formatDateLong, formatMoney } from "../utils/format";

interface Props {
  selection: RoomAvailability;
  query: AvailabilityQuery;
  onClose: () => void;
}

export function BookingRequestModal({ selection, query, onClose }: Props) {
  const { room, totalPrice, currency, nights, taxesAndFees } = selection;
  const { state, run } = useAsync<HotelBooking>();
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [requests, setRequests] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && state.kind === "done") setSubmitted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.kind]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    void run(() =>
      api.createHotelBooking({
        availabilityQuery: query,
        roomSlug: room.slug,
        contact,
        specialRequests: requests || undefined,
      }),
    );
  }

  const invalid =
    !contact.name.trim() ||
    !/^\S+@\S+\.\S+$/.test(contact.email) ||
    !contact.phone.trim();

  return (
    <Modal title={`Reserve — ${room.name}`} onClose={onClose}>
      {state.kind === "done" ? (
        <BookingConfirmation booking={state.data} />
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <dl className="confirm-summary">
            <div>
              <dt>Dates</dt>
              <dd>
                {formatDateLong(query.checkIn)} → {formatDateLong(query.checkOut)}{" "}
                ({nights} {nights === 1 ? "night" : "nights"})
              </dd>
            </div>
            <div>
              <dt>Guests</dt>
              <dd>
                {query.guests} · {query.rooms} {query.rooms === 1 ? "room" : "rooms"}
              </dd>
            </div>
            <div>
              <dt>Room</dt>
              <dd>{room.name}</dd>
            </div>
            <div>
              <dt>Price</dt>
              <dd>
                {formatMoney(totalPrice, currency)} total
                <ul className="confirm-taxes">
                  {taxesAndFees.map((t) => (
                    <li key={t.label}>
                      {t.label}: {formatMoney(t.amount, currency)}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          </dl>

          <div className="field">
            <label htmlFor="bk-name">Full name</label>
            <input
              id="bk-name"
              className="input"
              required
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="bk-email">Email</label>
            <input
              id="bk-email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="bk-phone">Telephone</label>
            <input
              id="bk-phone"
              className="input"
              type="tel"
              required
              autoComplete="tel"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="bk-requests">Special requests (optional)</label>
            <textarea
              id="bk-requests"
              className="input"
              rows={3}
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
            />
          </div>

          <p className="confirm-note">
            Free cancellation up to 48 hours before check-in. You'll review the
            full policy before payment.
          </p>

          {state.kind === "error" && (
            <p className="error-text" role="alert">
              {state.message}
            </p>
          )}

          <div className="confirm-actions">
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={invalid || state.kind === "loading" || submitted}
            >
              {state.kind === "loading" || submitted ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Sending…
                </>
              ) : isMockMode ? (
                "Request booking (preview)"
              ) : (
                "Continue to payment"
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function BookingConfirmation({ booking }: { booking: HotelBooking }) {
  return (
    <div className="text-center">
      <CheckCircle2 size={48} color="var(--forest)" aria-hidden="true" />
      <h3 className="mt-2">Booking confirmed</h3>
      {isMockMode && (
        <p className="badge badge--clay" role="note">
          Preview mode — this booking is simulated
        </p>
      )}
      <dl className="confirm-summary">
        <div>
          <dt>Reference</dt>
          <dd>
            <strong>{booking.reference}</strong>
          </dd>
        </div>
        <div>
          <dt>Room</dt>
          <dd>{booking.roomName}</dd>
        </div>
        <div>
          <dt>Dates</dt>
          <dd>
            {formatDateLong(booking.checkIn)} → {formatDateLong(booking.checkOut)}
          </dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>
            {formatMoney(booking.totalPrice, booking.currency)} ({booking.status.replace("_", " ")})
          </dd>
        </div>
      </dl>
      <p className="lede">
        Cancellation deadline: {formatDateLong(booking.cancellationDeadline)}. A
        confirmation email is on its way from the backend's notification system.
      </p>
      {booking.paymentUrl && (
        <a href={booking.paymentUrl} className="btn btn--primary btn--block">
          Continue to payment
        </a>
      )}
      <p className="mt-2">
        Keep your reference safe, or{" "}
        <Link to="/manage-booking">manage this booking</Link> later.
      </p>
    </div>
  );
}
