import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { StillGoodLogo } from "../components/StillGoodLogo";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register(name, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
          <span className="auth-media-eyebrow">Join the household · No. 01</span>
          <h1>
            Less food in the bin. More on the <em>plate</em>.
          </h1>
          <p>
            The average household tosses a third of the food it buys. StillGood
            quietly keeps the ledger of what&rsquo;s fresh, so you can cook with
            intention and save — without guilt.
          </p>
          <ul className="auth-media-bullets">
            <li>Free while in beta — no credit card</li>
            <li>Works with your existing groceries</li>
            <li>Invite the whole household in one tap</li>
          </ul>
        </div>

        <div className="auth-media-quote">
          <p>
            &ldquo;I stopped buying the same bag of spinach twice. Turns out
            I just needed a friendly reminder to use what I had.&rdquo;
          </p>
          <div className="auth-media-quote-attrib">
            <div className="auth-media-quote-avatar">NS</div>
            <span>Naomi S. · solo cook, Copenhagen</span>
          </div>
        </div>
      </aside>

      {/* Right: form */}
      <section className="auth-form-side">
        <form className="auth-form-shell" onSubmit={(event) => void submit(event)}>
          <div>
            <span className="section-eyebrow">Create account</span>
            <h2>
              Start tracking in <em>under a minute</em>.
            </h2>
            <p className="lede">
              A home for your fridge that pays attention so you don&rsquo;t have to.
            </p>
          </div>

          <div className="auth-form-field">
            <label htmlFor="reg-name">Your name</label>
            <input
              id="reg-name"
              required
              placeholder="Alex Baker"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="auth-form-field">
            <label htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              required
              placeholder="you@kitchen.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="auth-form-field">
            <label htmlFor="reg-pass">Password</label>
            <input
              id="reg-pass"
              type="password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Creating account…" : "Create my account →"}
          </button>

          <div className="auth-divider" role="separator" aria-label="or">
            <span>or</span>
          </div>

          <GoogleSignInButton label="Continue with Google" />

          <p className="auth-form-foot">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </form>
      </section>
    </div>
  );
}
