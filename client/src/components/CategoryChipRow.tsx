import { Item } from "../api/client";

const CATEGORY_DEFS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "all", label: "All", emoji: "🧺" },
  { key: "produce", label: "Produce", emoji: "🥬" },
  { key: "dairy", label: "Dairy", emoji: "🥛" },
  { key: "meat", label: "Meat & Fish", emoji: "🥩" },
  { key: "bread", label: "Bread", emoji: "🍞" },
  { key: "leftovers", label: "Leftovers", emoji: "🍱" },
  { key: "frozen", label: "Frozen", emoji: "🧊" },
  { key: "beverages", label: "Beverages", emoji: "🥤" },
  { key: "condiments", label: "Condiments", emoji: "🫙" },
  { key: "grains", label: "Grains", emoji: "🌾" },
  { key: "snacks", label: "Snacks", emoji: "🍿" },
  { key: "other", label: "Other", emoji: "📦" }
];

export function CategoryChipRow({
  items,
  active,
  onChange
}: {
  items: Item[];
  active: string;
  onChange: (key: string) => void;
}) {
  const counts = items.reduce<Record<string, number>>((acc, item) => {
    acc[item.category] = (acc[item.category] ?? 0) + 1;
    return acc;
  }, {});

  const visible = CATEGORY_DEFS.filter(
    (cat) => cat.key === "all" || (counts[cat.key] ?? 0) > 0
  );

  return (
    <div className="category-chip-row" role="tablist" aria-label="Filter by category">
      {visible.map((cat) => {
        const count = cat.key === "all" ? items.length : counts[cat.key] ?? 0;
        const isActive = active === cat.key;
        return (
          <button
            key={cat.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`category-chip${isActive ? " active" : ""}`}
            onClick={() => onChange(cat.key)}
          >
            <span aria-hidden>{cat.emoji}</span>
            <span>{cat.label}</span>
            <span className="chip-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}
