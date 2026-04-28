import { useState, useEffect, useCallback } from "react";

/* ────────── shared type ────────── */

export interface ItemType {
  id: string;
  name: string;
  category: string;
  status: "GOOD" | "WARNING" | "CRITICAL";
  rho?: number;
  daysRemaining: number;
  isOpen: boolean;
  expiresAt: string;
  openedAt?: string;
}

interface ItemCardProps {
  item: ItemType;
  onStateChange: (id: string, newState: Partial<ItemType>) => void;
}

/* ────────── constants ────────── */

const SHELF_LIFE: Record<string, number> = {
  dairy: 7,
  meat: 3,
  produce: 5,
  canned: 4,
  bread: 6,
  condiments: 30,
};
const DEFAULT_SHELF = 5;

/* ────────── helpers ────────── */

function shelfDays(category: string): number {
  return SHELF_LIFE[category.toLowerCase()] ?? DEFAULT_SHELF;
}

function freshnessBar(status: ItemType["status"], daysRemaining: number) {
  if (status === "GOOD") return { bg: "#1A6B4A", width: 100 };
  if (status === "WARNING") {
    return { bg: "#D4860A", width: Math.max(0, Math.min(100, (daysRemaining / 7) * 100)) };
  }
  return { bg: "#C0392B", width: 20 };
}

function daysLabel(d: number) {
  if (d <= 0) return "Expires today";
  return `${d} day${d === 1 ? "" : "s"} left`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeAgo(iso: string, now: Date): string {
  const then = new Date(iso);
  const diffMs = now.getTime() - then.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ────────── component ────────── */

export default function ItemCard({ item, onStateChange }: ItemCardProps) {
  const [busy, setBusy] = useState(false);
  const [flashing, setFlashing] = useState(false);

  /* Clear flash after 800ms */
  useEffect(() => {
    if (!flashing) return;
    const t = setTimeout(() => setFlashing(false), 800);
    return () => clearTimeout(t);
  }, [flashing]);

  /* ── derived state ── */
  const bar = freshnessBar(item.status, item.daysRemaining);
  const shelf = shelfDays(item.category);

  const borderClass =
    item.status === "CRITICAL"
      ? "border-red-800 bg-red-950/20"
      : item.status === "WARNING"
        ? "border-amber-800/50"
        : "border-zinc-800";

  /* ── optimistic "Mark Opened" ── */
  const handleMarkOpened = useCallback(() => {
    const optimisticDays = Math.min(shelf, item.daysRemaining);
    const now = new Date().toISOString();

    /* 1. Immediately push optimistic state to parent */
    onStateChange(item.id, {
      isOpen: true,
      status: "WARNING",
      daysRemaining: optimisticDays,
      openedAt: now,
    });

    /* Trigger flash to highlight the info text swap */
    setFlashing(true);

    /* 2. Fire POST in the background */
    setBusy(true);
    fetch(`/api/items/${item.id}/open`, {
      method: "POST",
      credentials: "include",
    }).finally(() => setBusy(false));
  }, [item.id, item.daysRemaining, shelf, onStateChange]);

  /* ── consume / discard ── */
  const handleConsume = useCallback(
    async (endpoint: string) => {
      setBusy(true);
      try {
        await fetch(endpoint, { method: "POST", credentials: "include" });
        /* let parent handle removal / refetch */
        onStateChange(item.id, { status: "GOOD" });
      } finally {
        setBusy(false);
      }
    },
    [item.id, onStateChange],
  );

  /* ── info text below freshness bar ── */
  const infoText = item.isOpen ? (
    <p
      className={`text-xs font-medium text-amber-400 transition-all duration-500 ${
        flashing ? "bg-amber-400/10 rounded px-1 -mx-1" : "bg-transparent rounded px-1 -mx-1"
      }`}
    >
      Shelf life started: {item.openedAt ? timeAgo(item.openedAt, new Date()) : "just now"}.{" "}
      Use within {shelf} days.
    </p>
  ) : (
    <p className="text-xs text-zinc-500">Expiration: {formatDate(item.expiresAt)}</p>
  );

  return (
    <div
      className={[
        "bg-zinc-900 border rounded-xl p-4 flex flex-col gap-3",
        "transition-all duration-700 ease-in-out",
        borderClass,
      ].join(" ")}
    >
      {/* ── name + category ── */}
      <div>
        <p className="font-bold text-white leading-snug">{item.name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{item.category}</p>
      </div>

      {/* ── freshness bar ── */}
      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-700 ease-in-out",
            item.status === "CRITICAL" ? "animate-pulse" : "",
          ].join(" ")}
          style={{ width: `${bar.width}%`, backgroundColor: bar.bg }}
        />
      </div>

      {/* ── info text (sealed vs opened — the core distinction) ── */}
      <div className="min-h-[20px] relative">
        {/* crossfade wrapper: we key on isOpen so React unmounts/remounts */}
        <div
          key={item.isOpen ? "open" : "sealed"}
          className="animate-[fadeSlideIn_400ms_ease_both]"
        >
          {infoText}
        </div>
      </div>

      {/* ── days remaining + badge ── */}
      <div className="flex items-center justify-between">
        <span
          className={`text-sm font-medium ${
            item.status === "CRITICAL"
              ? "text-red-400"
              : item.status === "WARNING"
                ? "text-amber-400"
                : "text-zinc-300"
          }`}
        >
          {daysLabel(item.daysRemaining)}
        </span>

        {/* badge crossfade — keyed swap for enter animation */}
        <span
          key={item.isOpen ? "badge-open" : "badge-sealed"}
          className={[
            "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
            "transition-all duration-500 ease-in-out",
            "animate-[fadeSlideIn_350ms_ease_both]",
            item.isOpen
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-zinc-600/30 text-zinc-400 border border-zinc-600/40",
          ].join(" ")}
        >
          {item.isOpen ? "Opened" : "Sealed"}
        </span>
      </div>

      {/* ── action buttons ── */}
      <div className="flex gap-2 mt-auto pt-1">
        {item.isOpen ? (
          <>
            <button
              disabled={busy}
              onClick={() => handleConsume(`/api/items/${item.id}/consume`)}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-50"
            >
              Consumed
            </button>
            <button
              disabled={busy}
              onClick={() => handleConsume(`/api/items/${item.id}/consume`)}
              className="flex-1 text-xs font-semibold py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-200 transition-colors disabled:opacity-50"
            >
              Discard
            </button>
          </>
        ) : (
          <button
            disabled={busy}
            onClick={handleMarkOpened}
            className="w-full text-xs font-semibold py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition-colors disabled:opacity-50"
          >
            Mark Opened
          </button>
        )}
      </div>
    </div>
}
