import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, Alert } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import AnalyticsSummary from "../components/AnalyticsSummary";
import RecipeSuggestions from "../components/RecipeSuggestions";
import InventoryGrid from "../components/InventoryGrid";

/* ════════════════════════════════════════════════════════════
   Toast system (dead‑simple, no external lib)
   ════════════════════════════════════════════════════════════ */

interface Toast {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}

let toastId = 0;

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => onDismiss(t.id)}
          className={[
            "pointer-events-auto px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg",
            "animate-[fadeSlideIn_300ms_ease_both] cursor-pointer",
            t.type === "success"
              ? "bg-emerald-600 text-white"
              : t.type === "error"
                ? "bg-red-600 text-white"
                : "bg-zinc-700 text-zinc-100",
          ].join(" ")}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   FreshEye Simulator dev panel
   ════════════════════════════════════════════════════════════ */

function FreshEyePanel({ onToast }: { onToast: (msg: string, type: Toast["type"]) => void }) {
  const [itemId, setItemId] = useState("");
  const [mode, setMode] = useState<"SEALED" | "OPEN">("SEALED");
  const [busy, setBusy] = useState(false);

  const simulate = async () => {
    if (!itemId.trim()) return;
    setBusy(true);
    try {
      // Try FreshEye simulator endpoint first, fall back to items/:id/open
      const primary = await fetch(`/api/fresheye/simulate`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: Number(itemId), mode }),
      });
      if (primary.ok) {
        onToast("Signal received", "success");
        return;
      }

      // Fallback
      const fallback = await fetch(`/api/items/${itemId}/open`, {
        method: "POST",
        credentials: "include",
      });
      if (fallback.ok) {
        onToast("Signal received", "success");
      } else {
        onToast("Simulation failed", "error");
      }
    } catch {
      onToast("Simulation failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-zinc-900 border border-dashed border-zinc-700 rounded-xl p-4">
      <p className="text-zinc-400 text-sm font-mono mb-3">FreshEye Simulator</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-zinc-500 text-xs mb-1">Item ID</label>
          <input
            type="number"
            value={itemId}
            onChange={(e) => setItemId(e.target.value)}
            placeholder="42"
            className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="block text-zinc-500 text-xs mb-1">State</label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "SEALED" | "OPEN")}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-zinc-500"
          >
            <option value="SEALED">Sealed</option>
            <option value="OPEN">Open</option>
          </select>
        </div>
        <button
          disabled={busy || !itemId.trim()}
          onClick={simulate}
          className="px-4 py-1.5 text-sm font-semibold rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors disabled:opacity-40"
        >
          Simulate Detection
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Dashboard page
   ════════════════════════════════════════════════════════════ */

export function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const showDev = searchParams.get("dev") === "true";

  /* ── alerts ── */
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    api.alerts().then((r) => setAlerts(r.alerts)).catch(() => {});
  }, []);

  const unreadCount = alerts.filter((a) => a.readAt === null).length;

  /* ── toasts ── */
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 2500);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── auth guard ── */
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-500 text-sm animate-pulse">Loading…</p>
      </div>
    );
  }

  if (!user) return null; // will redirect

  /* ── initials avatar ── */
  const initials = user.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* ── navbar ── */}
      <nav className="sticky top-0 z-50 bg-zinc-950/90 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* left: brand */}
          <span className="font-bold text-emerald-400 text-xl select-none">
            🌿 Still Good
          </span>

          {/* right: bell + avatar */}
          <div className="flex items-center gap-4">
            {/* alert bell */}
            <button
              onClick={() => navigate("/notifications")}
              className="relative text-xl leading-none text-zinc-400 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>

            {/* user chip */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-zinc-400 hidden sm:inline">{user.name}</span>
              <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-xs font-bold text-emerald-200 select-none">
                {initials}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* ── page content ── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <AnalyticsSummary />
        <RecipeSuggestions />
        <InventoryGrid />

        {/* FreshEye dev panel (only with ?dev=true) */}
        {showDev && <FreshEyePanel onToast={pushToast} />}
      </main>

      {/* ── toasts ── */}
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
