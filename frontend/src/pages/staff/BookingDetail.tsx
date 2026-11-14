import { useCallback, useEffect, useState } from "react";
import { ArrowRightLeft, Mail, Phone } from "lucide-react";
import {
  staffApi,
  type BookingStatus,
  type HistoryEntry,
  type RoomOption,
  type StaffBooking,
  type Stay,
} from "../../api/staff";
import { formatMoney, pluralize } from "../../utils/format";
import { actionLabel, shortDate, shortMoment } from "./format";

interface Props {
  booking: StaffBooking;
  onUpdated: (b: StaffBooking) => void;
  onError: (err: unknown) => boolean;
}

export default function BookingDetail({
  booking: b,
  onUpdated,
  onError,
}: Props) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState(b.staffNotes);
  const [moving, setMoving] = useState<number | null>(null);

  const loadHistory = useCallback(() => {
    staffApi
      .booking(b.id)
      .then((d) => setHistory(d.history))
      .catch(onError);
  }, [b.id, onError]);

  useEffect(loadHistory, [loadHistory]);
  useEffect(() => setNotes(b.staffNotes), [b.staffNotes]);

  async function run(action: () => Promise<StaffBooking>) {
    setBusy(true);
    setError(null);
    try {
      onUpdated(await action());
      loadHistory();
      return true;
    } catch (err) {
      if (!onError(err)) setError((err as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(to: BookingStatus) {
    if (
      to === "cancelled" &&
      !window.confirm(
        `Cancel ${b.reference} for ${b.guestName}? Their rooms become free for other guests.`,
      )
    ) {
      return;
    }
    void run(() => staffApi.setStatus(b.id, to));
  }

  const stays = b.stays.filter(
    (s) => s.status === "active" || b.status === "cancelled",
  );
  const canMove = ["pending_payment", "confirmed", "checked_in"].includes(
    b.status,
  );

  return (
    <div className="staff-detail">
      <div className="staff-detail__grid">
        <section>
          <h3>Guest</h3>
          <p className="staff-detail__name">{b.guestName}</p>
          <p>
            <a href={`mailto:${b.guestEmail}`}>
              <Mail size={15} aria-hidden="true" /> {b.guestEmail}
            </a>
          </p>
          <p>
            <a href={`tel:${b.guestPhone.replace(/\s/g, "")}`}>
              <Phone size={15} aria-hidden="true" /> {b.guestPhone}
            </a>
          </p>
          {b.specialRequests && (
            <p className="staff-detail__requests">
              <strong>Guest's request:</strong> {b.specialRequests}
            </p>
          )}
          <p className="staff-muted">
            Booked {shortMoment(b.createdAt)} on the{" "}
            {b.source === "website" ? "website" : "desk"} · {b.reference}
          </p>
        </section>

        <section>
          <h3>
            {pluralize(stays.length, "room")} · {shortDate(b.checkIn)} →{" "}
            {shortDate(b.checkOut)}
          </h3>
          <ul className="staff-stays">
            {stays.map((s) => (
              <li key={s.id}>
                <div className="staff-stay">
                  <span className="staff-stay__num">{s.roomNumber}</span>
                  <span>
                    <strong>{s.roomType}</strong>
                    <span className="staff-muted">
                      {pluralize(s.guests, "guest")} ·{" "}
                      {formatMoney(s.nightlyRate, b.currency)} / night
                      {s.status === "cancelled" && " · cancelled"}
                    </span>
                  </span>
                  {canMove && s.status === "active" && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm"
                      aria-expanded={moving === s.id}
                      onClick={() => setMoving(moving === s.id ? null : s.id)}
                    >
                      <ArrowRightLeft size={15} aria-hidden="true" /> Change
                      room
                    </button>
                  )}
                </div>
                {moving === s.id && (
                  <MovePanel
                    booking={b}
                    stay={s}
                    onCancel={() => setMoving(null)}
                    onMove={async (room, reprice) => {
                      const ok = await run(() =>
                        staffApi.moveStay(b.id, s.id, room, reprice),
                      );
                      if (ok) setMoving(null);
                    }}
                    onError={onError}
                  />
                )}
              </li>
            ))}
          </ul>
          <dl className="staff-money">
            <div>
              <dt>Room total</dt>
              <dd>{formatMoney(b.subtotal, b.currency)}</dd>
            </div>
            {b.discount > 0 && (
              <div>
                <dt>{b.discountLabel}</dt>
                <dd>−{formatMoney(b.discount, b.currency)}</dd>
              </div>
            )}
            {b.taxesAndFees.map((t) => (
              <div key={t.label}>
                <dt>{t.label}</dt>
                <dd>{formatMoney(t.amount, b.currency)}</dd>
              </div>
            ))}
            {b.cancellationFees > 0 && (
              <div>
                <dt>Cancellation fees</dt>
                <dd>{formatMoney(b.cancellationFees, b.currency)}</dd>
              </div>
            )}
            <div className="staff-money__total">
              <dt>Due</dt>
              <dd>{formatMoney(b.amountDue, b.currency)}</dd>
            </div>
          </dl>
        </section>
      </div>

      {b.nextStatuses.length > 0 && (
        <div className="staff-actions">
          {b.nextStatuses.map((to) => (
            <button
              key={to}
              type="button"
              disabled={busy}
              className={`btn btn--sm ${
                to === "cancelled" || to === "no_show"
                  ? "btn--ghost staff-actions__danger"
                  : to === "pending_payment" ||
                      b.status === "checked_out" ||
                      (b.status === "checked_in" && to === "confirmed")
                    ? "btn--ghost"
                    : "btn--primary"
              }`}
              onClick={() => changeStatus(to)}
            >
              {actionLabel(b.status, to)}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      <div className="staff-detail__grid">
        <section>
          <label className="staff-notes">
            <h3>Staff notes</h3>
            <textarea
              className="input"
              rows={3}
              placeholder="Only staff see these, e.g. “Paid ₹5,000 cash on arrival”"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy || notes.trim() === b.staffNotes}
            onClick={() => void run(() => staffApi.setNotes(b.id, notes))}
          >
            Save notes
          </button>
        </section>
        <section>
          <h3>History</h3>
          {history.length === 0 ? (
            <p className="staff-muted">No changes since the guest booked.</p>
          ) : (
            <ol className="staff-history">
              {history.map((h, i) => (
                <li key={i}>
                  <span className="staff-muted">{shortMoment(h.at)}</span>{" "}
                  {describe(h)}
                  {h.staff && <span className="staff-muted"> · {h.staff}</span>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}

/** One audit log line in words. */
function describe(h: HistoryEntry): string {
  const d = h.details as Record<string, string | number>;
  const status = (s: unknown) => String(s).replace(/_/g, " ");
  switch (h.action) {
    case "booking.status_changed":
      return `Status: ${status(d.from)} → ${status(d.to)}`;
    case "booking.room_switched":
      return `Moved from room ${d.from_room} to ${d.to_room}${
        d.from_rate_paise !== d.to_rate_paise ? " at the new room's price" : ""
      }`;
    case "booking.notes_changed":
      return "Staff notes edited";
    case "booking.cancelled_by_guest":
      return "Cancelled by the guest online";
    default:
      return h.action;
  }
}

interface MoveProps {
  booking: StaffBooking;
  stay: Stay;
  onCancel: () => void;
  onMove: (room: number, reprice: boolean) => Promise<void>;
  onError: (err: unknown) => boolean;
}

/** Pick another room for the same dates. Taken or closed rooms are shown, greyed out, with the reason. */
function MovePanel({ booking, stay, onCancel, onMove, onError }: MoveProps) {
  const [options, setOptions] = useState<RoomOption[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<number | null>(null);
  const [reprice, setReprice] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    staffApi
      .moveOptions(booking.id, stay.id)
      .then(setOptions)
      .catch((err) => {
        if (!onError(err)) setError((err as Error).message);
      });
  }, [booking.id, stay.id, onError]);

  const target = options?.find((o) => o.roomNumber === room);
  const priceDiffers = target && target.pricePerNight !== stay.nightlyRate;

  return (
    <div className="staff-move">
      <p className="staff-move__title">
        Move room {stay.roomNumber} ({pluralize(stay.guests, "guest")},{" "}
        {shortDate(stay.checkIn)} → {shortDate(stay.checkOut)}) to:
      </p>
      {error && <p className="error-text">{error}</p>}
      {!options && !error && <p className="staff-muted">Checking rooms…</p>}
      {options && (
        <div
          className="staff-move__rooms"
          role="radiogroup"
          aria-label="New room"
        >
          {options
            .filter((o) => !o.current)
            .map((o) => (
              <label
                key={o.roomNumber}
                className={`staff-move__room${o.free ? "" : " is-off"}${
                  room === o.roomNumber ? " is-picked" : ""
                }`}
              >
                <input
                  type="radio"
                  name={`move-${stay.id}`}
                  disabled={!o.free}
                  checked={room === o.roomNumber}
                  onChange={() => setRoom(o.roomNumber)}
                />
                <strong>{o.roomNumber}</strong>
                <span>{o.roomType}</span>
                <span className="staff-muted">
                  {o.free
                    ? `${formatMoney(o.pricePerNight, booking.currency)} / night`
                    : o.reason}
                </span>
              </label>
            ))}
        </div>
      )}
      {priceDiffers && (
        <label className="staff-move__reprice">
          <input
            type="checkbox"
            checked={reprice}
            onChange={(e) => setReprice(e.target.checked)}
          />
          Charge room {target.roomNumber}'s price:{" "}
          {formatMoney(target.pricePerNight, booking.currency)} instead of{" "}
          {formatMoney(stay.nightlyRate, booking.currency)} a night. Leave
          unticked to keep the price the guest booked.
        </label>
      )}
      <div className="staff-move__buttons">
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={room === null || saving}
          onClick={async () => {
            setSaving(true);
            await onMove(room!, Boolean(priceDiffers && reprice));
            setSaving(false);
          }}
        >
          {room ? `Move to room ${room}` : "Choose a room"}
        </button>
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
