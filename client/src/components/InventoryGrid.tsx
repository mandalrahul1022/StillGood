import { useState, useEffect, useCallback } from "react";
import ItemCard, { ItemType } from "./ItemCard";

/* ────────── types ────────── */

type Filter = "all" | "expiring" | "critical";

/* ────────── skeleton ────────── */

function SkeletonCard() {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-zinc-700 rounded w-3/4 mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-1/2 mb-4" />
      <div className="h-1.5 bg-zinc-800 rounded-full w-full mb-3" />
      <div className="h-3 bg-zinc-800 rounded w-1/3 mb-4" />
      <div className="flex gap-2 mt-auto">
        <div className="h-8 bg-zinc-800 rounded-lg flex-1" />
      </div>
    </div>
  );
}

/* ────────── main component ────────── */

export default function InventoryGrid() {
  const [items, setItems] = useState<ItemType[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("all");

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/items?status=active", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        // Normalise backend shape → ItemType
        const list: ItemType[] = (data.items ?? data).map((raw: Record<string, unknown>) => ({
          id: String(raw.id),
          name: raw.name as string,
          category: raw.category as string,
          status: mapStatus(raw.status as string),
          rho: raw.rho as number | undefined,
          daysRemaining: raw.daysRemaining as number,
          isOpen: raw.opened === true || raw.isOpen === true,
          expiresAt: raw.expiresAt as string,
          openedAt: (raw.openedAt as string) ?? undefined,
        }));
        setItems(list);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  /* ── optimistic state change handler for ItemCard ── */
  const handleStateChange = useCallback(
    (id: string, patch: Partial<ItemType>) => {
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    []
  );

  /* ── client-side filtering ── */
  const displayed = items.filter((i) => {
    if (filter === "expiring") return i.daysRemaining <= 4;
    if (filter === "critical") return i.status === "CRITICAL";
    return true;
  });

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "expiring", label: "Expiring Soon" },
    { key: "critical", label: "Critical" },
  ];

  return (
    <section className="w-full">
      {/* header */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-2xl font-bold text-white">Your Inventory</h2>
        <span className="text-zinc-400 text-sm">
          {items.length} item{items.length !== 1 && "s"}
        </span>
      </div>

      {/* filter tabs */}
      <div className="flex gap-1 mb-5 mt-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              filter === f.key
                ? "bg-white/10 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {/* empty state */}
      {!loading && displayed.length === 0 && (
        <div className="border border-dashed border-zinc-700 rounded-xl p-10 text-center">
          <p className="text-zinc-400 text-sm">
            Your fridge looks empty. Add your first item.
          </p>
        </div>
      )}

      {/* grid */}
      {!loading && displayed.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayed.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onStateChange={handleStateChange}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/* ── map backend status to ItemType status ── */

function mapStatus(s: string): ItemType["status"] {
  const upper = s.toUpperCase();
  if (upper === "FRESH" || upper === "GOOD") return "GOOD";
  if (upper === "USE_SOON" || upper === "WARNING") return "WARNING";
  if (upper === "EXPIRED" || upper === "CRITICAL") return "CRITICAL";
  return "GOOD";
}
