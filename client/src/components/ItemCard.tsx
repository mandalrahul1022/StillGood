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
  other: "📦"
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
  other: "linear-gradient(135deg, #f0eee8 0%, #d9d3c2 100%)"
};

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  if (days === 1) return "1 day left";
  return `${days} days left`;
}

function freshnessPercent(daysRemaining: number): number {
  if (daysRemaining <= 0) return 100;
  return Math.min(100, Math.max(8, Math.round((daysRemaining / 30) * 100)));
}

function statusLabel(status: Item["status"]) {
  if (status === "FRESH") return "Fresh";
  if (status === "USE_SOON") return "Use Soon";
  return "Expired";
}

export function ItemCard({
  item,
  onOpen,
  onConsume,
  onEdit,
  onDelete
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
      <div
        className="item-card-media"
        style={{ background: gradient }}
      >
        <span className={`item-card-pill ${statusClass}`}>{statusLabel(item.status)}</span>
        {item.opened === true && (
          <span className="item-card-opened-tag">Opened</span>
        )}
        <span className="item-card-emoji" aria-hidden>{emoji}</span>
      </div>

      <div className="item-card-body">
        <div className="item-card-head">
          <h3 className="item-card-name" title={item.name}>{item.name}</h3>
          <span className="item-card-meta">
            {item.category} · {item.quantity}
          </span>
        </div>

        <div className="item-card-freshness">
          <div className="item-card-freshness-label">
            <span>Freshness</span>
            <span className="days-left">{daysLabel(item.daysRemaining)}</span>
          </div>
          <div className="freshness-bar">
            <div
              className={`freshness-fill ${statusClass}`}
              style={{ width: `${freshnessPercent(item.daysRemaining)}%` }}
            />
          </div>
        </div>

        <div className="item-card-actions">
          <button
            className="button tiny"
            disabled={item.opened === true}
            onClick={() => onOpen(item)}
          >
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
