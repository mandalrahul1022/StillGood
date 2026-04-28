import { useState, useEffect, useCallback } from "react";
import { Item } from "../api/client";

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
  other: "📦",
};

const CATEGORY_GRADIENT: Record<string, string> = {
  produce: "linear-gradient(135deg, #dff0ea 0%, #b7dfcb 100%)",
  dairy: "linear-gradient(135deg, #eef4ff 0%, #cfe0f7 100%)",
  meat: "linear-gradient(135deg, #ffe5dc 0%, #f7b7a1 100%)",
  leftovers: "linear-gradient(135deg, #fff1d1 0%, #f3d18a 100%)",
  bread: "linear-gradient(135deg, #fff4e0 0%, #f2d7a8 100%)",
  frozen: "linear-gradient(135deg, #e8f3f7 0%, #bcdee8 100%)",
  beverages: "linear-gradient(135deg, #e6f4ff 0%, #b9dcf3 100%)",
  condiments: "linear-gradient(135deg, #fff4e0 0%, #fbd8a5 100%)",
  grains: "linear-gradient(135deg, #faf1dc 0%, #eaca8a 100%)",
  snacks: "linear-gradient(135deg, #fdecec 0%, #f4b9b9 100%)",
  other: "linear-gradient(135deg, #f0eee8 0%, #d9d3c2 100%)",
};

function dashboardDaysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function dashboardFreshnessPercent(daysRemaining: number): number {
  if (daysRemaining <= 0) return 100;
  return Math.min(100, Math.max(8, Math.round((daysRemaining / 30) * 100)));
}

function dashboardStatusLabel(status: Item["status"]) {
  if (status === "FRESH") return "Fresh";
  if (status === "USE_SOON") return "Use Soon";
  return "Expired";
}

export function ItemCard({
  item,
  onOpen,
  onConsume,
  onEdit,
  onDelete,
}: {
  item: Item;
  onOpen: (item: Item) => void;
  onConsume: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}) {
  const emoji = CATEGORY_EMOJI[item.category] ?? "📦";
  const gradient = CATEGORY_GRADIENT[item.category] ?? CATEGORY_GRADIENT.other;
  const statusClass = item.status.toLowerCase();

  return (
    <article className="item-card">
      <div className="item-card-media" style={{ background: gradient }}>
        <span className={`item-card-pill ${statusClass}`}>{dashboardStatusLabel(item.status)}</span>
        {item.opened === true && <span className="item-card-opened-tag">Opened</span>}
        <span className="item-card-emoji" aria-hidden>
          {emoji}
        </span>
      </div>

      <div className="item-card-body">
        <div className="item-card-head">
          <h3 className="item-card-name" title={item.name}>
            {item.name}
          </h3>
          <span className="item-card-meta">
            {item.category} · {item.quantity}
          </span>
        </div>

        <div className="item-card-freshness">
          <div className="item-card-freshness-label">
            <span>Freshness</span>
            <span className="days-left">{dashboardDaysLabel(item.daysRemaining)}</span>
          </div>
          <div className="freshness-bar">
            <div
              className={`freshness-fill ${statusClass}`}
              style={{ width: `${dashboardFreshnessPercent(item.daysRemaining)}%` }}
            />
          </div>
        </div>

        <div className="item-card-actions">
          <button className="button tiny" disabled={item.opened === true} onClick={() => onOpen(item)}>
            {item.opened === true ? "Opened" : "Open"}
          </button>
          <button className="button tiny secondary" onClick={() => onConsume(item)}>
            Consume
          </button>
          <button className="button tiny ghost" onClick={() => onEdit(item)}>
            Edit
          </button>
          <button className="button tiny danger" onClick={() => onDelete(item)} aria-label="Delete">
            ✕
          </button>
        </div>
      </div>
    </article>
  );
}

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

interface InventoryItemCardProps {
  item: ItemType;
  onStateChange: (id: string, newState: Partial<ItemType>) => void;
}

const SHELF_LIFE: Record<string, number> = {
  dairy: 7,
  meat: 3,
  produce: 5,
  canned: 4,
  bread: 6,
  condiments: 30,
};
const DEFAULT_SHELF = 5;

function inventoryShelfDays(category: string): number {
  return SHELF_LIFE[category.toLowerCase()] ?? DEFAULT_SHELF;
}

function inventoryFreshnessBar(status: ItemType["status"], daysRemaining: number) {
  if (status === "GOOD") return { bg: "#1A6B4A", width: 100 };
  if (status === "WARNING") {
    return { bg: "#D4860A", width: Math.max(0, Math.min(100, (daysRemaining / 7) * 100)) };
  }
  return { bg: "#C0392B", width: 20 };
}

function inventoryDaysLabel(days: number) {
  if (days <= 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

function inventoryFormatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function inventoryTimeAgo(iso: string, now: Date): string {
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

export default function InventoryItemCard({ item, onStateChange }: InventoryItemCardProps) {
  const [busy, setBusy] = useState(false);
  const [flashing, setFlashing] = useState(false);

  useEffect(() => {
    if (!flashing) return;
    const t = setTimeout(() => setFlashing(false), 800);
    return () => clearTimeout(t);
  }, [flashing]);

  const bar = inventoryFreshnessBar(item.status, item.daysRemaining);
  const shelf = inventoryShelfDays(item.category);

  const borderClass =
    item.status === "CRITICAL"
      ? "border-red-800 bg-red-950/20"
      : item.status === "WARNING"
        ? "border-amber-800/50"
        : "border-zinc-800";

  const handleMarkOpened = useCallback(() => {
    const optimisticDays = Math.min(shelf, item.daysRemaining);
    const now = new Date().toISOString();

    onStateChange(item.id, {
      isOpen: true,
      status: "WARNING",
      daysRemaining: optimisticDays,
      openedAt: now,
    });

    setFlashing(true);
    setBusy(true);
    fetch(`/api/items/${item.id}/open`, {
      method: "POST",
      credentials: "include",
    }).finally(() => setBusy(false));
  }, [item.id, item.daysRemaining, shelf, onStateChange]);

  const handleConsume = useCallback(
    async (endpoint: string) => {
      setBusy(true);
      try {
        await fetch(endpoint, { method: "POST", credentials: "include" });
        onStateChange(item.id, { status: "GOOD" });
      } finally {
        setBusy(false);
      }
    },
    [item.id, onStateChange],
  );

  const infoText = item.isOpen ? (
    <p
      className={`text-xs font-medium text-amber-400 transition-all duration-500 ${
        flashing ? "bg-amber-400/10 rounded px-1 -mx-1" : "bg-transparent rounded px-1 -mx-1"
      }`}
    >
      Shelf life started: {item.openedAt ? inventoryTimeAgo(item.openedAt, new Date()) : "just now"}. Use
      within {shelf} days.
    </p>
  ) : (
    <p className="text-xs text-zinc-500">Expiration: {inventoryFormatDate(item.expiresAt)}</p>
  );

  return (
    <div
      className={[
        "bg-zinc-900 border rounded-xl p-4 flex flex-col gap-3",
        "transition-all duration-700 ease-in-out",
        borderClass,
      ].join(" ")}
    >
      <div>
        <p className="font-bold text-white leading-snug">{item.name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">{item.category}</p>
      </div>

      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-700 ease-in-out",
            item.status === "CRITICAL" ? "animate-pulse" : "",
          ].join(" ")}
          style={{ width: `${bar.width}%`, backgroundColor: bar.bg }}
        />
      </div>

      <div className="min-h-[20px] relative">
        <div key={item.isOpen ? "open" : "sealed"} className="animate-[fadeSlideIn_400ms_ease_both]">
          {infoText}
        </div>
      </div>

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
          {inventoryDaysLabel(item.daysRemaining)}
        </span>

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
  );
}
