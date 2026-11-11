import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import type { BuffetBooking, BuffetSlot } from "../api/types";
import { api, isMockMode } from "../api/client";
import { useAsync } from "../hooks/useAsync";
import { Modal } from "./Modal";
import { ContactFields, emptyContact, isContactComplete } from "./ContactFields";
import { formatDateLong, pluralize } from "../utils/format";

interface Props {
  date: string;
  partySize: number;
  slots: BuffetSlot[];
  /** Time already picked on the page, if it is still free. */
  initialTime?: string | null;
  onClose: () => void;
}

export function BuffetBookingModal({
  date,
  partySize,
  slots,
  initialTime = null,
  onClose,
}: Props) {
  const { state, run } = useAsync<BuffetBooking>();
  const [time, setTime] = useState<string | null>(initialTime);
  const [contact, setContact] = useState(emptyContact);
  const [requests, setRequests] = useState("");
  const sending = state.kind === "loading";
  const invalid = !time || !isContactComplete(contact);
  const openSlots = slots.filter((s) => s.available);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!time || invalid || sending) return;
    void run(() =>
      api.createBuffetBooking({
        date,
        time,
        partySize,
        contact,
        specialRequests: requests.trim() || undefined,
      }),
    );
  }

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
                {pluralize(state.data.partySize, "guest")}
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
            {formatDateLong(date)} · {pluralize(partySize, "guest")}
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

          <ContactFields
            idPrefix="rs"
            contact={contact}
            onContactChange={setContact}
            requests={requests}
            onRequestsChange={setRequests}
          />

          {state.kind === "error" && (
            <p className="error-text" role="alert">
              {state.message}
            </p>
          )}

          <div className="confirm-actions">
            <button
              type="submit"
              className="btn btn--primary btn--block"
              disabled={invalid || sending}
            >
              {sending ? (
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
