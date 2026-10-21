import { Link } from "react-router-dom";
import { BedDouble, CalendarCheck, UtensilsCrossed } from "lucide-react";
import { isMockMode } from "../api/client";
import { formatDateLong, todayISO } from "../utils/format";
import "./StaffDashboardPage.css";

/**
 * Placeholder staff dashboard. The real dashboard will render today's
 * arrivals, departures and restaurant reservations from the backend's
 * staff API, with search, filters, status management and check-in/out
 * controls. All authorization must be enforced server-side.
 */
export default function StaffDashboardPage() {
  const today = todayISO();

  return (
    <div className="staff-dash">
      <header className="staff-dash__bar">
        <div className="container staff-dash__bar-inner">
          <h1>Staff dashboard</h1>
          <p className="staff-dash__date">{formatDateLong(today)}</p>
          <Link to="/" className="staff-dash__exit">
            Leave dashboard
          </Link>
        </div>
      </header>

      <div className="container staff-dash__body">
        {isMockMode && (
          <p className="badge badge--clay" role="note">
            Preview mode — the staff API and real authentication are not yet
            connected. Nothing below is live data.
          </p>
        )}

        <div className="staff-cards">
          <section className="card" aria-labelledby="arr-title">
            <h2 id="arr-title">
              <BedDouble size={20} aria-hidden="true" /> Arrivals today
            </h2>
            <p className="lede">
              Placeholder — will list today's incoming reservations with guest
              names, contact info and room assignments.
            </p>
            <p className="badge badge--water">No live data yet</p>
          </section>
          <section className="card" aria-labelledby="dep-title">
            <h2 id="dep-title">
              <CalendarCheck size={20} aria-hidden="true" /> Departures today
            </h2>
            <p className="lede">
              Placeholder — will list today's departures with check-out status.
            </p>
            <p className="badge badge--water">No live data yet</p>
          </section>
          <section className="card" aria-labelledby="res-title">
            <h2 id="res-title">
              <UtensilsCrossed size={20} aria-hidden="true" /> Restaurant
              reservations
            </h2>
            <p className="lede">
              Placeholder — will list today's tables with times, party sizes
              and guest contact details.
            </p>
            <p className="badge badge--water">No live data yet</p>
          </section>
        </div>

        <section className="card staff-dash__plan" aria-labelledby="plan-title">
          <h2 id="plan-title">Planned for the real backend</h2>
          <ul className="staff-plan">
            <li>Secure staff sign-in enforced by the backend session</li>
            <li>Reservation list with search, filters and status editing</li>
            <li>Check-in / check-out management with clear status indicators</li>
            <li>Creating, editing and cancelling bookings and reservations</li>
            <li>Payment status overview (pending, paid, refunded)</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
