import { FormEvent, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { StillGoodLogo } from "../components/StillGoodLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

function formatOAuthError(code: string | null): string | null {
  if (!code) return null;
  switch (code) {
    case "access_denied":
      return "Google sign-in was cancelled.";
    case "email_not_verified":
      return "Your Google email isn't verified. Verify it with Google and try again.";
    case "state_expired":
    case "state_mismatch":
      return "Sign-in took too long or was opened in a new tab. Please try again.";
    case "token_exchange_failed":
    case "id_token_decode_failed":
    case "no_id_token":
      return "Google returned an unexpected response. Please try again.";
    default:
      return "Google sign-in failed. Please try again.";
  }
}

export function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const oauthError = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return formatOAuthError(params.get("error"));
  }, [location.search]);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-split">
      {/* Left: editorial hero */}
      <aside className="auth-media">
        <div className="auth-media-top">
          <StillGoodLogo />
          <span className="brand">StillGood</span>
          <span className="pill">Beta</span>
        </div>

        <div className="auth-media-body">
          <span className="auth-media-eyebrow">Welcome back · No. 04</span>
          <h1>
            The kitchen that <em>wastes less</em> starts at the fridge door.
          </h1>
          <p>
            Freshness tracking, use-soon nudges, and recipe ideas from the
            ingredients you already own. Log in and pick up where your
            household left off.
          </p>
          <ul className="auth-media-bullets">
            <li>Shared household inventory</li>
            <li>Smart freshness predictions</li>
            <li>Receipt + Gmail auto-import</li>
          </ul>
        </div>

        <div className="auth-media-quote">
          <p>
            &ldquo;StillGood turned our &lsquo;mystery fridge&rsquo; into a
            proper kitchen. We save roughly £32 a week and eat better.&rdquo;
          </p>
          <div className="auth-media-quote-attrib">
            <div className="auth-media-quote-avatar">JK</div>
            <span>Jamie K. · household of 3, Bristol</span>
          </div>
        </div>
      </aside>

      {/* Right: form */}
      <section className="auth-form-side">
        <form className="auth-form-shell" onSubmit={(event) => void submit(event)}>
          <div>
            <span className="section-eyebrow">Sign in</span>
            <h2>
              Welcome <em>back</em>.
            </h2>
            <p className="lede">
              Keep tracking freshness and prevent avoidable waste.
            </p>
          </div>

          <div className="auth-form-field">
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              type="email"
              required
              placeholder="you@kitchen.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="auth-form-field">
            <label htmlFor="login-pass">Password</label>
            <input
              id="login-pass"
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {!error && oauthError ? <p className="error-text">{oauthError}</p> : null}

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Signing in…" : "Sign in →"}
          </button>

          <div className="auth-divider" role="separator" aria-label="or">
            <span>or</span>
          </div>

          <GoogleSignInButton label="Sign in with Google" />

          <p className="auth-form-foot">
            No account yet? <Link to="/register">Create one in 30 seconds</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
