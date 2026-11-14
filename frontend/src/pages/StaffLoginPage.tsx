import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { ApiRequestError } from "../api/client";
import { staffApi, staffAvailable } from "../api/staff";
import "./StaffLoginPage.css";

/**
 * Staff sign-in. The backend checks the password and sets an HttpOnly session
 * cookie; the dashboard's data is only ever served to a valid session, so
 * hiding this page would add nothing.
 */
export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // already signed in on this browser: go straight to the dashboard
  useEffect(() => {
    if (!staffAvailable) return;
    staffApi
      .me()
      .then(() => navigate("/staff/dashboard", { replace: true }))
      .catch(() => {});
  }, [navigate]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await staffApi.login(email, password);
      navigate("/staff/dashboard");
    } catch (err) {
      setPassword("");
      setError(
        err instanceof ApiRequestError && err.status !== 0
          ? err.message
          : "Cannot reach the booking server. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="staff-login">
      <form className="card staff-login__card" onSubmit={submit}>
        <p className="eyebrow">Staff area</p>
        <h1>Staff sign-in</h1>
        {staffAvailable ? (
          <p className="lede">For hotel staff only.</p>
        ) : (
          <p className="badge badge--clay staff-login__note" role="note">
            The site is in preview mode, without the booking server. Start it
            with <code>npm run dev:api</code> (see backend/README.md) to sign
            in.
          </p>
        )}
        <div className="field">
          <label htmlFor="st-email">Work email</label>
          <input
            id="st-email"
            className="input"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="st-password">Password</label>
          <input
            id="st-password"
            className="input"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn--primary btn--block"
          disabled={loading || !staffAvailable}
        >
          <Lock size={16} aria-hidden="true" />
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <Link to="/" className="staff-login__back">
          ← Back to the website
        </Link>
      </form>
    </div>
  );
}
