import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";

interface GmailStatus {
  connected: boolean;
  email: string | null;
  lastSyncAt: string | null;
  configured: boolean;
}

function formatRelative(iso: string | null): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function GmailGlyph() {
  return (
    <svg width="28" height="28" viewBox="0 0 48 48">
      <path fill="#4285f4" d="M6 12v24a2 2 0 0 0 2 2h6V21.6l10 7.4 10-7.4V38h6a2 2 0 0 0 2-2V12l-18 12.6L6 12Z" />
      <path fill="#34a853" d="M14 38V21.6L6 15.8V36a2 2 0 0 0 2 2h6Z" />
      <path fill="#ea4335" d="M34 38V21.6l8-5.8V36a2 2 0 0 1-2 2h-6Z" />
      <path fill="#fbbc05" d="M14 21.6L24 29l10-7.4V10l-10 7.4L14 10v11.6Z" />
      <path fill="#c5221f" d="M14 21.6V10l10 7.4-10 4.2Z" opacity="0" />
    </svg>
  );
}

export function IntegrationsPage() {
  const [gmail, setGmail] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const loadStatus = useCallback(async () => {
    try {
      const res = await api.integrationsStatus();
      setGmail(res.gmail);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("connected") === "gmail") {
      setSuccess("Gmail connected — receipts will now flow in automatically.");
      void loadStatus();
      navigate("/integrations", { replace: true });
    } else if (params.get("error")) {
      setError("Gmail connection was cancelled or failed.");
      navigate("/integrations", { replace: true });
    }
  }, [location.search, navigate, loadStatus]);

  const handleConnect = () => {
    setError(null);
    setSuccess(null);
    window.location.href = api.gmailConnectUrl();
  };

  const handleDisconnect = async () => {
    setError(null);
    setSuccess(null);
    setDisconnecting(true);
    try {
      await api.gmailDisconnect();
      setSuccess("Gmail disconnected.");
      await loadStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleScan = async () => {
    setError(null);
    setSuccess(null);
    setScanning(true);
    try {
      const result = await api.gmailScan();
      if (result.added === 0 && result.skipped === 0) {
        setSuccess("No new receipts found — inbox is clear.");
      } else if (result.added === 0) {
        setSuccess(`No new items added (${result.skipped} already in your inventory).`);
      } else {
        setSuccess(
          `Pulled in ${result.added} item${result.added === 1 ? "" : "s"}${
            result.skipped > 0
              ? ` (skipped ${result.skipped} duplicate${result.skipped === 1 ? "" : "s"})`
              : ""
          }.`
        );
      }
      await loadStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="stack">
      <div className="page-hero">
        <div className="page-hero-icon">🔌</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="section-eyebrow">Integrations</span>
          <h2>
            Fewer keystrokes, <em>more cooking</em>
          </h2>
          <p>
            Connect the services already bringing groceries into your home —
            StillGood does the data entry so you can do the eating.
          </p>
        </div>
      </div>

      {error && (
        <div className="integration-banner error">
          <span className="integration-banner-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="integration-banner success">
          <span className="integration-banner-icon">✓</span>
          <span>{success}</span>
        </div>
      )}

      {/* Receipt Scanner */}
      <div className="integration-brand-card active">
        <div className="integration-brand-row">
          <div className="integration-brand-logo sage" aria-hidden>🧾</div>
          <div className="integration-brand-body">
            <h3>
              Receipt scanner
              <span className="integration-status-dot connected">Active</span>
            </h3>
            <p>
              Snap or upload a grocery receipt. We OCR it, classify each item,
              and stage them for your review before adding to inventory.
            </p>
          </div>
        </div>

        <div className="integration-meta-row">
          <span>⚡ Powered by <strong>TabScanner</strong> OCR</span>
          <span>📸 JPEG, PNG, WebP, PDF</span>
          <span>🧠 Category auto-detection</span>
        </div>

        <div className="integration-action-row">
          <Link to="/scan-receipt" className="button">
            📷 Scan a receipt
          </Link>
          <Link to="/add-item" className="button ghost">
            Add manually
          </Link>
        </div>
      </div>

      {/* Gmail */}
      <div className="integration-brand-card gmail">
        <div className="integration-brand-row">
          <div className="integration-brand-logo gmail" aria-hidden>
            <GmailGlyph />
          </div>
          <div className="integration-brand-body">
            <h3>
              Gmail receipts
              {gmail?.connected ? (
                <span className="integration-status-dot connected">Connected</span>
              ) : gmail?.configured ? (
                <span className="integration-status-dot disconnected">Disconnected</span>
              ) : (
                <span className="integration-status-dot coming">Setup needed</span>
              )}
            </h3>
            <p>
              Read-only access to find grocery & delivery receipts in your
              inbox. Items are extracted with Gemini Flash and queued for
              one-tap add.
            </p>
          </div>
        </div>

        <div className="integration-meta-row">
          {loading ? (
            <span>Loading status…</span>
          ) : gmail?.connected ? (
            <>
              <span>
                📬 <strong>{gmail.email}</strong>
              </span>
              <span>
                🕒 Last sync <strong>{formatRelative(gmail.lastSyncAt)}</strong>
              </span>
              <span>✓ Read-only scope</span>
            </>
          ) : gmail?.configured ? (
            <span>
              Safe read-only access — extracts items from receipts & delivery confirmations.
            </span>
          ) : (
            <span>
              Set <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code>, and{" "}
              <code>GEMINI_API_KEY</code> in <code>server/.env</code> to enable.
            </span>
          )}
        </div>

        <div className="integration-action-row">
          {!loading && !gmail?.connected && (
            <button
              className="button"
              onClick={handleConnect}
              disabled={!gmail?.configured}
            >
              {gmail?.configured ? "Connect Gmail →" : "Configuration required"}
            </button>
          )}
          {!loading && gmail?.connected && (
            <>
              <button className="button" onClick={handleScan} disabled={scanning}>
                {scanning ? "Scanning inbox…" : "📬 Scan for receipts now"}
              </button>
              <button
                className="button ghost"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Coming Soon */}
      <div className="integration-brand-card coming">
        <div className="integration-brand-row">
          <div className="integration-brand-logo slate" aria-hidden>🛒</div>
          <div className="integration-brand-body">
            <h3>
              Grocery app sync
              <span className="integration-status-dot coming">On the roadmap</span>
            </h3>
            <p>
              Instacart, Kroger, Walmart — sync your cart the moment an order is
              delivered. No photos, no forwarding, no thinking. Coming soon.
            </p>
          </div>
        </div>

        <div className="integration-action-row">
          <button className="button ghost" disabled>
            Notify me when it ships
          </button>
        </div>
      </div>

      {/* CTA band */}
      <section className="cta-band" style={{ marginTop: 8 }}>
        <div>
          <h3>Missing an integration you&rsquo;d actually use?</h3>
          <p>
            Tell us which app brings groceries into your life and we&rsquo;ll
            prioritise the next connector. We build for real kitchens.
          </p>
        </div>
        <a href="mailto:hello@stillgood.app?subject=Integration%20request" className="button">
          Request one →
        </a>
      </section>
    </section>
  );
}
