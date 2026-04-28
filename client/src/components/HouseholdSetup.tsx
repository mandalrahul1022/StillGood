import { FormEvent, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthProvider";

export function HouseholdSetup() {
  const { refresh } = useAuth();
  const [createName, setCreateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"create" | "join" | null>(null);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy("create");
    try {
      await api.createHousehold({ name: createName });
      setCreateName("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create household");
    } finally {
      setBusy(null);
    }
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy("join");
    try {
      await api.joinHousehold({ inviteCode });
      setInviteCode("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join household");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="household-setup">
      <div className="household-setup-header">
        <div className="household-setup-icon" aria-hidden>🏠</div>
        <div>
          <span className="section-eyebrow sage">Set up your kitchen</span>
          <h3 style={{ fontFamily: '"Merriweather", serif', fontSize: 20, margin: "4px 0 2px" }}>
            Start fresh, or join the family
          </h3>
          <p style={{ fontSize: 13.5 }}>
            StillGood works best when everyone sharing a fridge is on the same page.
          </p>
        </div>
      </div>

      <div className="household-tile-row">
        <div className="household-tile">
          <div>
            <h4>Create a household</h4>
            <p>Give it a name — &ldquo;Maple Street Kitchen&rdquo; or just &ldquo;Home&rdquo;.</p>
          </div>
          <form onSubmit={(event) => void create(event)} className="stack">
            <input
              required
              placeholder="e.g. Baker Family"
              value={createName}
              onChange={(event) => setCreateName(event.target.value)}
            />
            <button className="button" disabled={busy === "create"}>
              {busy === "create" ? "Creating…" : "Create household →"}
            </button>
          </form>
        </div>

        <div className="household-tile-divider" aria-hidden>
          <span>or</span>
        </div>

        <div className="household-tile">
          <div>
            <h4>Join with invite code</h4>
            <p>Your partner or housemate can grab one from their Settings page.</p>
          </div>
          <form onSubmit={(event) => void join(event)} className="stack">
            <input
              required
              placeholder="Paste the code here"
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
            />
            <button className="button secondary" disabled={busy === "join"}>
              {busy === "join" ? "Joining…" : "Join household"}
            </button>
          </form>
        </div>
      </div>

      {error ? <p className="error-text" style={{ marginTop: 14 }}>{error}</p> : null}
    </section>
  );
}
