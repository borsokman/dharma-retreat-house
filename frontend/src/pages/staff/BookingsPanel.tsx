import { useEffect, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  staffApi,
  statusLabel,
  type BookingView,
  type StaffBooking,
} from "../../api/staff";
import { formatMoney, pluralize } from "../../utils/format";
import BookingDetail from "./BookingDetail";
import { shortDate, statusBadge } from "./format";

const views: { id: BookingView; label: string }[] = [
  { id: "upcoming", label: "Upcoming & in house" },
  { id: "arrivals", label: "Arrivals today" },
  { id: "departures", label: "Departures today" },
  { id: "in_house", label: "In house" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
  { id: "all", label: "All" },
];

interface Props {
  view: BookingView;
  onView: (v: BookingView) => void;
  search: string;
  onSearch: (q: string) => void;
  /** a booking changed: the counts at the top may be stale */
  onChanged: () => void;
  onError: (err: unknown) => boolean;
}

export default function BookingsPanel({
  view,
  onView,
  search,
  onSearch,
  onChanged,
  onError,
}: Props) {
  const [typed, setTyped] = useState(search);
  const [list, setList] = useState<StaffBooking[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  // the search box follows outside changes (e.g. "open booking" from Rooms)
  useEffect(() => setTyped(search), [search]);

  // search as staff type, a moment after they stop
  useEffect(() => {
    if (typed === search) return;
    const t = setTimeout(() => onSearch(typed), 250);
    return () => clearTimeout(t);
  }, [typed, search, onSearch]);

  useEffect(() => {
    let live = true;
    setError(null);
    staffApi
      .bookings(view, search)
      .then((l) => {
        if (!live) return;
        setList(l);
        // a search for one reference opens it straight away
        setOpenId(l.length === 1 && search ? l[0]!.id : null);
      })
      .catch((err) => {
        if (live && !onError(err)) setError((err as Error).message);
      });
    return () => {
      live = false;
    };
  }, [view, search, onError]);

  function replace(b: StaffBooking) {
    setList((l) => l && l.map((x) => (x.id === b.id ? b : x)));
    onChanged();
  }

  return (
    <section aria-label="Bookings">
      <div className="staff-filters">
        <label className="staff-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">Search bookings</span>
          <input
            className="input"
            type="search"
            placeholder="Name, email, phone, reference or room number"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        <div className="staff-views" role="group" aria-label="Show">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              className={v.id === view ? "is-active" : ""}
              aria-pressed={v.id === view}
              onClick={() => onView(v.id)}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {list === null && !error && <p className="staff-muted">Loading…</p>}
      {list && list.length === 0 && (
        <p className="staff-empty">
          {search
            ? `Nothing matches “${search}” here. Try “All”.`
            : "No bookings here."}
        </p>
      )}

      {list && list.length > 0 && (
        <ul className="staff-bookings">
          {list.map((b) => {
            const open = b.id === openId;
            const active = b.stays.filter(
              (s) => s.status === "active" || b.status === "cancelled",
            );
            return (
              <li
                key={b.id}
                className={`staff-booking${open ? " is-open" : ""}`}
              >
                <button
                  type="button"
                  className="staff-booking__row"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : b.id)}
                >
                  <span className="staff-booking__guest">
                    <strong>{b.guestName}</strong>
                    <span>{b.guestEmail}</span>
                    <span>{b.guestPhone}</span>
                  </span>
                  <span className="staff-booking__dates">
                    <strong>
                      {shortDate(b.checkIn)} → {shortDate(b.checkOut)}
                    </strong>
                    <span>
                      {pluralize(b.nights, "night")} ·{" "}
                      {pluralize(b.guests, "guest")}
                    </span>
                  </span>
                  <span className="staff-booking__rooms">
                    <strong>
                      {active.length === 1 ? "Room " : "Rooms "}
                      {active.map((s) => s.roomNumber).join(", ")}
                    </strong>
                    <span>{b.reference}</span>
                  </span>
                  <span className="staff-booking__status">
                    <span className={`badge ${statusBadge[b.status]}`}>
                      {statusLabel[b.status]}
                    </span>
                    <span>{formatMoney(b.total, b.currency)}</span>
                  </span>
                  <ChevronDown
                    className="staff-booking__chevron"
                    size={20}
                    aria-hidden="true"
                  />
                </button>
                {open && (
                  <BookingDetail
                    booking={b}
                    onUpdated={replace}
                    onError={onError}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
