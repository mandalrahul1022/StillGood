import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { useAuth } from "../auth/AuthProvider";

const CATEGORY_EMOJI: Record<string, string> = {
  produce: "🥬",
  dairy: "🥛",
  meat: "🥩",
  leftovers: "🍱",
  bread: "🍞",
  frozen: "🧊",
  beverages: "🥤",
  condiments: "🫙",
  grains: "🌾",
  snacks: "🍿",
  other: "📦"
};

function formatTime(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationsPage() {
  const { household } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const load = useCallback(async () => {
    if (!household) return;
    setError(null);
    try {
      const response = await api.alerts();
      setAlerts(response.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alerts");
    }
  }, [household]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!household) {
    return (
      <section className="stack">
        <div className="page-hero">
          <div className="page-hero-icon">🔔</div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <span className="section-eyebrow">Notifications</span>
            <h2>
              Join a <em>household</em> to see alerts
            </h2>
            <p>Notifications are generated from your shared inventory — set up a household to start receiving them.</p>
          </div>
        </div>
        <HouseholdSetup />
      </section>
    );
  }

  const runSweep = async () => {
    setRunning(true);
    setError(null);
    try {
      await api.runAlerts();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run alert sweep");
    } finally {
      setRunning(false);
    }
  };

  const markRead = async (id: string) => {
    setError(null);
    try {
      await api.readAlert(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark alert read");
    }
  };

  const markAllRead = async () => {
    setError(null);
    try {
      const unread = alerts.filter((a) => !a.readAt);
      await Promise.all(unread.map((a) => api.readAlert(a.id)));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark all read");
    }
  };

  const unreadCount = alerts.filter((a) => !a.readAt).length;
  const expiredCount = alerts.filter((a) => a.type === "EXPIRED").length;
  const useSoonCount = alerts.filter((a) => a.type === "USE_SOON").length;

  const filteredAlerts = filter === "unread" ? alerts.filter((a) => !a.readAt) : alerts;

  return (
    <section className="stack">
      <div className="page-hero">
        <div className="page-hero-icon">🔔</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="section-eyebrow">Notifications</span>
          <h2>
            Your kitchen, <em>whispering</em> to you
          </h2>
          <p>
            Friendly nudges when food is about to turn. Mark them read, run a
            sweep, or jump back to the inventory to act.
          </p>
        </div>
        <button
          className="button"
          onClick={() => void runSweep()}
          disabled={running}
        >
          {running ? "Checking…" : "↻ Run alert sweep"}
        </button>
      </div>

      <div className="notifications-toolbar">
        <div className="notifications-summary">
          <span className={`notifications-summary-pill${unreadCount > 0 ? " unread" : ""}`}>
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </span>
          {useSoonCount > 0 && (
            <span className="notifications-summary-pill">⏳ {useSoonCount} use-soon</span>
          )}
          {expiredCount > 0 && (
            <span className="notifications-summary-pill">⚠️ {expiredCount} past prime</span>
          )}
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div className="segmented">
            <button
              className={filter === "all" ? "active" : ""}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={filter === "unread" ? "active" : ""}
              onClick={() => setFilter("unread")}
            >
              Unread
            </button>
          </div>
          {unreadCount > 0 && (
            <button className="button ghost" onClick={() => void markAllRead()}>
              Mark all read
            </button>
          )}
        </div>
      </div>

      {error ? <p className="error-text">{error}</p> : null}

      {filteredAlerts.length === 0 ? (
        <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
          <EmptyState
            title={filter === "unread" ? "No unread alerts" : "Your inbox is empty"}
            description={
              filter === "unread"
                ? "You're all caught up. Switch to All to see previously read alerts."
                : "Run an alert sweep to check for items that need attention."
            }
          />
        </div>
      ) : (
        <ul className="alert-card-list">
          {filteredAlerts.map((alert) => {
            const isExpired = alert.type === "EXPIRED";
            const iconEmoji = isExpired ? "⚠️" : "⏳";
            const unread = !alert.readAt;
            return (
              <li
                key={alert.id}
                className={`alert-card ${unread ? "unread" : "read"} ${isExpired ? "expired" : "use-soon"}`}
              >
                <div className={`alert-card-icon ${isExpired ? "expired" : "use-soon"}`} aria-hidden>
                  {iconEmoji}
                </div>
                <div className="alert-card-body">
                  <strong>{alert.message}</strong>
                  <p>
                    <span>{CATEGORY_EMOJI[alert.item.category] ?? "📦"} {alert.item.name}</span>
                    <span className="dot">·</span>
                    <span className="cat-tag">{alert.item.category}</span>
                    <span className="dot">·</span>
                    <span>{formatTime(alert.createdAt)}</span>
                  </p>
                </div>
                <div className="alert-card-action">
                  {unread ? (
                    <button className="button tiny" onClick={() => void markRead(alert.id)}>
                      Mark read
                    </button>
                  ) : (
                    <span className="alert-card-read-tag">Read</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {alerts.length > 0 && (
        <p className="subtle" style={{ textAlign: "center", fontSize: 12.5, marginTop: 4 }}>
          Want fewer pings? Tune notification preferences in{" "}
          <Link to="/settings">Settings</Link>.
        </p>
      )}
    </section>
  );
}
