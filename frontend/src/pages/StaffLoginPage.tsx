import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { api } from "../api/client";
import "./StaffLoginPage.css";

/**
 * Placeholder staff login. Real authentication and authorization must be
 * enforced by the Go backend (e.g. session tokens on /api/v1/staff/*) —
 * hiding this route in the frontend is not a security measure.
 */
export default function StaffLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.listRooms(); // Placeholder check while backend auth is pending.
      navigate("/staff/dashboard");
    } catch {
      setError("Sign-in is not available yet — the staff backend is pending.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="staff-login">
      <form className="card staff-login__card" onSubmit={submit}>
        <p className="eyebrow">Staff area</p>
        <h1>Staff sign-in</h1>
        <p className="lede">
          For hotel and restaurant employees only. Access is verified by the
          backend.
        </p>
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
          disabled={loading}
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
