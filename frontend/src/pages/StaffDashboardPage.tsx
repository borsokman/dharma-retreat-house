import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { ApiRequestError } from "../api/client";
import {
  staffApi,
  staffAvailable,
  type BookingView,
  type StaffUser,
  type TodayCounts,
} from "../api/staff";
import { formatDateLong } from "../utils/format";
import BookingsPanel from "./staff/BookingsPanel";
import RoomsPanel from "./staff/RoomsPanel";
import "./StaffDashboardPage.css";

type Tab = "bookings" | "rooms";

/**
 * Staff dashboard: every booking with the guest's details and rooms, status
 * changes, moving guests to another room, and taking rooms out of service.
 * The backend checks the session on every request; a 401 sends staff back to
 * the sign-in page.
 */
export default function StaffDashboardPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<StaffUser | null>(null);
  const [today, setToday] = useState<TodayCounts | null>(null);
  const [tab, setTab] = useState<Tab>("bookings");
  const [view, setView] = useState<BookingView>("upcoming");
  const [search, setSearch] = useState("");
  const [unreachable, setUnreachable] = useState(false);
  const [attempt, setAttempt] = useState(0);

  /** Any request that finds the session gone ends up here. */
  const onError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiRequestError && err.status === 401) {
        navigate("/staff", { replace: true });
        return true;
      }
      return false;
    },
    [navigate],
  );

  const refreshToday = useCallback(() => {
    staffApi.today().then(setToday).catch(onError);
  }, [onError]);

  useEffect(() => {
    if (!staffAvailable) {
      navigate("/staff", { replace: true });
      return;
    }
    setUnreachable(false);
    staffApi
      .me()
      .then((u) => {
        setUser(u);
        refreshToday();
      })
      .catch((err) => {
        if (!onError(err)) setUnreachable(true);
      });
  }, [navigate, onError, refreshToday, attempt]);

  async function signOut() {
    await staffApi.logout().catch(() => {});
    navigate("/staff", { replace: true });
  }

  function showBookings(v: BookingView, q = "") {
    setTab("bookings");
    setView(v);
    setSearch(q);
  }

  if (!user) {
    return (
      <div className="staff-dash">
        {unreachable ? (
          <div className="staff-dash__loading" role="alert">
            <p>Cannot reach the booking server.</p>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setAttempt((n) => n + 1)}
            >
              Try again
            </button>
          </div>
        ) : (
          <p className="staff-dash__loading">Checking your sign-in…</p>
        )}
      </div>
    );
  }

  const stats: { label: string; value: number; view?: BookingView }[] = today
    ? [
        { label: "Arrivals today", value: today.arrivals, view: "arrivals" },
        {
          label: "Departures today",
          value: today.departures,
          view: "departures",
        },
        { label: "In house", value: today.inHouse, view: "in_house" },
        {
          label: "Awaiting payment",
          value: today.awaitingPayment,
          view: "upcoming",
        },
        { label: "Rooms free tonight", value: today.roomsFree },
        { label: "Out of service", value: today.outOfService },
      ]
    : [];

  return (
    <div className="staff-dash">
      <header className="staff-dash__bar">
        <div className="container staff-dash__bar-inner">
          <h1>Staff dashboard</h1>
          <p className="staff-dash__date">
            {today ? formatDateLong(today.date) : ""}
          </p>
          <div className="staff-dash__user">
            <span>
              {user.name}
              {user.role === "admin" && " · admin"}
            </span>
            <button
              type="button"
              className="staff-dash__exit"
              onClick={signOut}
            >
              <LogOut size={16} aria-hidden="true" /> Sign out
            </button>
            <Link to="/" className="staff-dash__exit">
              Website
            </Link>
          </div>
        </div>
      </header>

      <div className="container staff-dash__body">
        <ul className="staff-stats" aria-label="Today">
          {stats.map((s) => (
            <li key={s.label}>
              <button
                type="button"
                className="staff-stat"
                onClick={() =>
                  s.view ? showBookings(s.view) : setTab("rooms")
                }
              >
                <strong>{s.value}</strong> {s.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="staff-tabs" role="tablist" aria-label="Dashboard">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "bookings"}
            className={tab === "bookings" ? "is-active" : ""}
            onClick={() => setTab("bookings")}
          >
            Bookings
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rooms"}
            className={tab === "rooms" ? "is-active" : ""}
            onClick={() => setTab("rooms")}
          >
            Rooms
          </button>
        </div>

        {tab === "bookings" ? (
          <BookingsPanel
            view={view}
            onView={setView}
            search={search}
            onSearch={setSearch}
            onChanged={refreshToday}
            onError={onError}
          />
        ) : (
          <RoomsPanel
            onOpenBooking={(ref) => showBookings("all", ref)}
            onChanged={refreshToday}
            onError={onError}
          />
        )}
      </div>
    </div>
  );
}
