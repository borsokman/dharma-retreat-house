import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import type {
  RestaurantBooking,
  RestaurantSlot,
} from "../api/types";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Modal } from "./Modal";
import { formatDateLong } from "../utils/format";

interface Props {
  date: string;
  partySize: number;
  slots: RestaurantSlot[];
  onClose: () => void;
}

export function RestaurantBookingModal({ date, partySize, slots, onClose }: Props) {
  const { state, run } = useAsync<RestaurantBooking>();
  const [time, setTime] = useState<string | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [requests, setRequests] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!time) return;
    void run(() =>
      api.createRestaurantBooking({
        date,
        time,
        partySize,
        contact,
        specialRequests: requests || undefined,
      }),
    );
  }

  const invalid = !time || !contact.name.trim() || !/^\S+@\S+\.\S+$/.test(contact.email) || !contact.phone.trim();
  const openSlots = slots.filter((s) => s.available);

  return (
    <Modal title="Reserve a table" onClose={onClose}>
      {state.kind === "done" ? (
        <div className="text-center">
          <CheckCircle2 size={48} color="var(--forest)" aria-hidden="true" />
          <h3 className="mt-2">Table reserved</h3>
          {isMockMode && (
            <p className="badge badge--clay" role="note">
              Preview mode — this reservation is simulated
            </p>
          )}
          <dl className="confirm-summary">
            <div>
              <dt>Reference</dt>
              <dd>
                <strong>{state.data.reference}</strong>
              </dd>
            </div>
            <div>
              <dt>When</dt>
              <dd>
                {formatDateLong(state.data.date)} at {state.data.time}
              </dd>
            </div>
            <div>
              <dt>Party</dt>
              <dd>
                {state.data.partySize} {state.data.partySize === 1 ? "guest" : "guests"}
              </dd>
            </div>
          </dl>
          <p className="lede">
            {isMockMode
              ? "With the real backend, a confirmation email with cancellation instructions would arrive now."
              : "A confirmation email with cancellation instructions is on its way."}
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="lede">
            {formatDateLong(date)} · {partySize}{" "}
            {partySize === 1 ? "guest" : "guests"}
          </p>
          <fieldset className="slot-picker">
            <legend>Choose a time</legend>
            {openSlots.length === 0 ? (
              <p className="error-text" role="alert">
                No tables left at this size on this date — try another date or a
                different party size.
              </p>
            ) : (
              <div className="slot-grid">
                {openSlots.map((s) => (
                  <button
                    key={s.time}
                    type="button"
                    className={`slot ${time === s.time ? "slot--selected" : ""}`}
                    aria-pressed={time === s.time}
                    onClick={() => setTime(s.time)}
                  >
                    {s.time}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <div className="field">
            <label htmlFor="rs-name">Full name</label>
            <input
              id="rs-name"
              className="input"
              required
              autoComplete="name"
              value={contact.name}
              onChange={(e) => setContact((c) => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="rs-email">Email</label>
            <input
              id="rs-email"
              className="input"
              type="email"
              required
              autoComplete="email"
              value={contact.email}
              onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="rs-phone">Telephone</label>
            <input
              id="rs-phone"
              className="input"
              type="tel"
              required
              autoComplete="tel"
              value={contact.phone}
              onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
          <div className="field">
            <label htmlFor="rs-requests">Special requests (optional)</label>
            <textarea
              id="rs-requests"
              className="input"
              rows={3}
              value={requests}
              onChange={(e) => setRequests(e.target.value)}
            />
          </div>

          {state.kind === "error" && (
            <p className="error-text" role="alert">
              {state.message}
            </p>
          )}

          <div className="confirm-actions">
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={invalid || state.kind === "loading"}
            >
              {state.kind === "loading" ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Reserving…
                </>
              ) : isMockMode ? (
                "Reserve table (preview)"
              ) : (
                "Reserve table"
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
