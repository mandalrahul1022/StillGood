import { FormEvent, useEffect, useState } from "react";
import { api } from "../api/client";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { useAuth } from "../auth/AuthProvider";

interface Member {
  id: string;
  name: string;
  email: string;
  role: "OWNER" | "MEMBER";
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function SettingsPage() {
  const { user, household, setProfile, refresh } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [householdName, setHouseholdName] = useState(user?.householdName ?? "");
  const [prefsEmail, setPrefsEmail] = useState(Boolean(user?.prefsEmail));
  const [prefsInApp, setPrefsInApp] = useState(Boolean(user?.prefsInApp));
  const [members, setMembers] = useState<Member[]>([]);
  const [inviteCode, setInviteCode] = useState(household?.inviteCode ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    setName(user?.name ?? "");
    setHouseholdName(user?.householdName ?? "");
    setPrefsEmail(Boolean(user?.prefsEmail));
    setPrefsInApp(Boolean(user?.prefsInApp));
  }, [user]);

  useEffect(() => {
    setInviteCode(household?.inviteCode ?? "");
  }, [household]);

  useEffect(() => {
    if (!household) {
      setMembers([]);
      return;
    }
    api
      .getMembers()
      .then((response) => setMembers(response.members))
      .catch(() => setMembers([]));
  }, [household]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError(null);
    try {
      await setProfile({
        name,
        householdName: householdName.trim() === "" ? null : householdName,
        prefsEmail,
        prefsInApp
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const regenerateInvite = async () => {
    setError(null);
    setRegenerating(true);
    try {
      const response = await api.regenerateInvite();
      setInviteCode(response.inviteCode);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate invite");
    } finally {
      setRegenerating(false);
    }
  };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteCode || household?.inviteCode || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  };

  return (
    <section className="stack">
      <div className="page-hero">
        <div className="page-hero-icon honey">⚙️</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="section-eyebrow honey">Settings</span>
          <h2>
            Make StillGood <em>yours</em>
          </h2>
          <p>
            Tune your profile, pick the alerts that reach you, and manage who
            shares your household&rsquo;s kitchen.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Profile */}
        <section className="settings-section">
          <div className="settings-section-head">
            <div className="settings-section-icon">👤</div>
            <div>
              <h3>Profile</h3>
              <p>How we greet you across the app.</p>
            </div>
          </div>

          <form onSubmit={(event) => void submit(event)} className="stack" style={{ gap: 16 }}>
            <div className="settings-field-grid">
              <div className="settings-field">
                <label htmlFor="settings-name">Display name</label>
                <input
                  id="settings-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="settings-field">
                <label htmlFor="settings-hh">Household nickname</label>
                <input
                  id="settings-hh"
                  value={householdName}
                  onChange={(event) => setHouseholdName(event.target.value)}
                  placeholder="e.g. Home, Maple Street…"
                />
              </div>
            </div>

            <div>
              <div className="settings-pref-row">
                <div className="settings-pref-text">
                  <strong>📧 Email notifications</strong>
                  <span>Use-soon and expired alerts in your inbox.</span>
                </div>
                <div
                  className={`toggle-switch${prefsEmail ? " on" : ""}`}
                  onClick={() => setPrefsEmail((v) => !v)}
                  role="switch"
                  aria-checked={prefsEmail}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") setPrefsEmail((v) => !v);
                  }}
                >
                  <div className="toggle-thumb" />
                </div>
              </div>
              <div className="settings-pref-row">
                <div className="settings-pref-text">
                  <strong>🔔 In-app notifications</strong>
                  <span>Show the bell badge on the dashboard.</span>
                </div>
                <div
                  className={`toggle-switch${prefsInApp ? " on" : ""}`}
                  onClick={() => setPrefsInApp((v) => !v)}
                  role="switch"
                  aria-checked={prefsInApp}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") setPrefsInApp((v) => !v);
                  }}
                >
                  <div className="toggle-thumb" />
                </div>
              </div>
            </div>

            {error ? <p className="error-text">{error}</p> : null}
            {saved ? <p className="success-text">✓ Saved. Looking sharp.</p> : null}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="button">Save settings</button>
            </div>
          </form>
        </section>

        {/* Household */}
        {household ? (
          <section className="settings-section">
            <div className="settings-section-head">
              <div className="settings-section-icon tomato">🏡</div>
              <div>
                <h3>Household</h3>
                <p>Everyone under this roof sees the same fridge.</p>
              </div>
            </div>

            <div className="household-info">
              <div className="household-info-stat">
                <span>Household</span>
                <strong>{household.name}</strong>
              </div>
              <div className="household-info-stat">
                <span>Your role</span>
                <strong style={{ textTransform: "capitalize" }}>
                  {household.role.toLowerCase()}
                </strong>
              </div>
              <div className="household-info-stat">
                <span>Members</span>
                <strong>{members.length || 1}</strong>
              </div>
            </div>

            <div className="invite-code-box">
              <span aria-hidden style={{ fontSize: 20 }}>🔑</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span
                  style={{
                    display: "block",
                    fontSize: 10.5,
                    fontWeight: 800,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--honey-deep)",
                    marginBottom: 3,
                    opacity: 0.8
                  }}
                >
                  Invite code
                </span>
                <code>{inviteCode || household.inviteCode}</code>
              </div>
              <button
                type="button"
                className="button tiny secondary"
                onClick={() => void copyInvite()}
              >
                {copied ? "✓ Copied" : "Copy"}
              </button>
              {household.role === "OWNER" && (
                <button
                  type="button"
                  className="button tiny ghost"
                  onClick={() => void regenerateInvite()}
                  disabled={regenerating}
                >
                  {regenerating ? "…" : "↻ Regenerate"}
                </button>
              )}
            </div>

            <h4
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--ink-soft)",
                margin: "8px 0 10px",
                fontWeight: 800
              }}
            >
              Members
            </h4>
            <ul className="member-list">
              {members.length === 0 ? (
                <li className="member-row">
                  <div className="member-avatar">{initials(user?.name ?? "?")}</div>
                  <div className="member-info">
                    <strong>{user?.name ?? "You"}</strong>
                    <span>{user?.email ?? ""}</span>
                  </div>
                  <span className="member-role-pill owner">Owner</span>
                </li>
              ) : (
                members.map((member) => (
                  <li key={member.id} className="member-row">
                    <div className="member-avatar">{initials(member.name)}</div>
                    <div className="member-info">
                      <strong>{member.name}</strong>
                      <span>{member.email}</span>
                    </div>
                    <span
                      className={`member-role-pill ${member.role === "OWNER" ? "owner" : "member"}`}
                    >
                      {member.role === "OWNER" ? "Owner" : "Member"}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </section>
        ) : (
          <HouseholdSetup />
        )}

        {/* About / danger zone */}
        <section className="settings-section">
          <div className="settings-section-head">
            <div className="settings-section-icon honey">ℹ️</div>
            <div>
              <h3>About StillGood</h3>
              <p>Version, credits, and gentle goodbyes.</p>
            </div>
          </div>
          <div className="settings-field-grid">
            <div className="household-info-stat">
              <span>Version</span>
              <strong>Beta · 0.3.0</strong>
            </div>
            <div className="household-info-stat">
              <span>Signed in as</span>
              <strong>{user?.email}</strong>
            </div>
          </div>
          <p style={{ fontSize: 13, marginTop: 14, color: "var(--ink-soft)" }}>
            Have feedback or an idea that would make your kitchen quieter?{" "}
            <a href="mailto:hello@stillgood.app">Tell us</a> — we read everything.
          </p>
        </section>
      </div>
    </section>
  );
}
