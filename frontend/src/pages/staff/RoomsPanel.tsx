import { useCallback, useEffect, useState } from "react";
import { Ban, CheckCircle2 } from "lucide-react";
import { staffApi, type Room } from "../../api/staff";
import { shortDate } from "./format";

interface Props {
  onOpenBooking: (reference: string) => void;
  onChanged: () => void;
  onError: (err: unknown) => boolean;
}

/**
 * The 12 rooms tonight. Marking a room unavailable takes it out of the booking
 * form at once; the backend refuses while it still has current or future guests,
 * and names those bookings so staff can move them first.
 */
export default function RoomsPanel({
  onOpenBooking,
  onChanged,
  onError,
}: Props) {
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    staffApi
      .rooms()
      .then(setRooms)
      .catch((err) => {
        if (!onError(err)) setError((err as Error).message);
      });
  }, [onError]);

  useEffect(load, [load]);

  if (error) {
    return (
      <p className="error-text" role="alert">
        {error}
      </p>
    );
  }
  if (!rooms) return <p className="staff-muted">Loading…</p>;

  return (
    <section aria-label="Rooms">
      <p className="staff-muted staff-rooms__intro">
        An unavailable room is hidden from the booking form until you make it
        available again. Guests already booked into it must be moved first.
      </p>
      <ul className="staff-rooms">
        {rooms.map((r) => (
          <RoomCard
            key={r.number}
            room={r}
            onOpenBooking={onOpenBooking}
            onSaved={(updated) => {
              setRooms(
                (list) =>
                  list &&
                  list.map((x) => (x.number === updated.number ? updated : x)),
              );
              onChanged();
            }}
            onError={onError}
          />
        ))}
      </ul>
    </section>
  );
}

function RoomCard({
  room: r,
  onOpenBooking,
  onSaved,
  onError,
}: {
  room: Room;
  onOpenBooking: (reference: string) => void;
  onSaved: (r: Room) => void;
  onError: (err: unknown) => boolean;
}) {
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const off = r.status === "out_of_service";

  async function save(status: Room["status"]) {
    setSaving(true);
    setError(null);
    try {
      onSaved(await staffApi.setRoomStatus(r.number, status, note));
      setClosing(false);
      setNote("");
    } catch (err) {
      if (!onError(err)) setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const state = off
    ? { label: "Unavailable", badge: "badge--sunset" }
    : r.tonight
      ? { label: "Occupied tonight", badge: "badge--water" }
      : { label: "Free tonight", badge: "badge--sage" };

  return (
    <li className={`card staff-room${off ? " is-off" : ""}`}>
      <div className="staff-room__head">
        <span className="staff-room__num">{r.number}</span>
        <span>
          <strong>{r.roomType}</strong>
          <span className="staff-muted">Up to {r.maxGuests} guests</span>
        </span>
      </div>
      <span className={`badge ${state.badge} staff-room__badge`}>
        {state.label}
      </span>

      {off && r.note && <p className="staff-room__note">{r.note}</p>}
      {r.tonight && (
        <p className="staff-room__stay">
          <span className="staff-muted">Tonight:</span>{" "}
          <button
            type="button"
            className="staff-link"
            onClick={() => onOpenBooking(r.tonight!.reference)}
          >
            {r.tonight.guestName}
          </button>{" "}
          until {shortDate(r.tonight.checkOut)}
        </p>
      )}
      {r.next && (
        <p className="staff-room__stay">
          <span className="staff-muted">Next:</span>{" "}
          <button
            type="button"
            className="staff-link"
            onClick={() => onOpenBooking(r.next!.reference)}
          >
            {r.next.guestName}
          </button>{" "}
          from {shortDate(r.next.checkIn)}
        </p>
      )}

      {closing ? (
        <div className="staff-room__close">
          <label>
            <span className="sr-only">Reason (optional)</span>
            <input
              className="input"
              placeholder="Reason, e.g. Leaking shower (optional)"
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="staff-move__buttons">
            <button
              type="button"
              className="btn btn--primary btn--sm"
              disabled={saving}
              onClick={() => void save("out_of_service")}
            >
              Mark unavailable
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                setClosing(false);
                setError(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : off ? (
        <button
          type="button"
          className="btn btn--ghost btn--sm staff-room__btn"
          disabled={saving}
          onClick={() => void save("active")}
        >
          <CheckCircle2 size={15} aria-hidden="true" /> Make available
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--ghost btn--sm staff-room__btn"
          onClick={() => setClosing(true)}
        >
          <Ban size={15} aria-hidden="true" /> Mark unavailable…
        </button>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </li>
  );
}
