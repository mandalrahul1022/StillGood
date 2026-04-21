import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { useAuth } from "../auth/AuthProvider";

const categories = [
  { value: "produce", label: "Produce", emoji: "🥬" },
  { value: "dairy", label: "Dairy", emoji: "🥛" },
  { value: "meat", label: "Meat & Fish", emoji: "🥩" },
  { value: "leftovers", label: "Leftovers", emoji: "🍱" },
  { value: "bread", label: "Bread", emoji: "🍞" },
  { value: "frozen", label: "Frozen", emoji: "🧊" },
  { value: "beverages", label: "Beverages", emoji: "🥤" },
  { value: "condiments", label: "Condiments", emoji: "🫙" },
  { value: "grains", label: "Grains & Pasta", emoji: "🌾" },
  { value: "snacks", label: "Snacks", emoji: "🍿" },
  { value: "other", label: "Other", emoji: "📦" }
];

const CATEGORY_DEFAULTS: Record<string, number> = {
  produce: 5,
  dairy: 7,
  meat: 3,
  leftovers: 4,
  bread: 5,
  frozen: 90,
  beverages: 14,
  condiments: 60,
  grains: 180,
  snacks: 30,
  other: 7
};

const QUANTITY_CHIPS = ["1 unit", "1 pack", "500g", "1L", "1 dozen", "1 bunch"];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatExpiry(dateAddedStr: string, days: number): string {
  const base = dateAddedStr ? new Date(dateAddedStr) : new Date();
  base.setDate(base.getDate() + days);
  return base.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function freshnessColor(days: number): string {
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "fresh";
}

export function AddItemPage() {
  const navigate = useNavigate();
  const { household } = useAuth();
  const [name, setName] = useState("");
  const [category, setCategory] = useState("produce");
  const [quantity, setQuantity] = useState("");
  const [opened, setOpened] = useState(false);
  const [customFreshDays, setCustomFreshDays] = useState("");
  const [dateAdded, setDateAdded] = useState(todayISO());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const estimatedDays = useMemo(() => {
    if (customFreshDays.trim() !== "") {
      const n = Number(customFreshDays);
      if (!Number.isNaN(n) && n > 0) return n;
    }
    const base = CATEGORY_DEFAULTS[category] ?? 7;
    return opened ? Math.max(1, Math.floor(base * 0.5)) : base;
  }, [category, customFreshDays, opened]);

  if (!household) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>Create or join a household first</h2>
          <p>Items belong to a household inventory.</p>
        </div>
        <HouseholdSetup />
      </section>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await api.createItem({
        name,
        category,
        quantity,
        opened,
        customFreshDays: customFreshDays.trim() === "" ? null : Number(customFreshDays),
        dateAdded
      });
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="stack">
      <div className="page-hero">
        <div className="page-hero-icon sage">➕</div>
        <div style={{ flex: 1, minWidth: 240 }}>
          <span className="section-eyebrow sage">Add to inventory</span>
          <h2>
            One more item, <em>zero</em> waste.
          </h2>
          <p>
            Track a fresh arrival by hand, or scan a receipt to pull in
            a whole shop in one go.
          </p>
        </div>
        <Link to="/scan-receipt" className="button secondary">
          🧾 Scan receipt
        </Link>
      </div>

      <form className="stack" onSubmit={(event) => void submit(event)}>
        {/* Category picker */}
        <div className="panel stack">
          <div>
            <h3 className="form-section-title">Category</h3>
            <p>What kind of item is this?</p>
          </div>
          <div className="category-grid">
            {categories.map((cat) => (
              <button
                key={cat.value}
                type="button"
                className={`category-btn${category === cat.value ? " selected" : ""}`}
                onClick={() => setCategory(cat.value)}
              >
                <span className="category-emoji">{cat.emoji}</span>
                <span className="category-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Item details */}
        <div className="panel stack">
          <h3 className="form-section-title">Item Details</h3>
          <div className="form-grid">
            <label className="form-field">
              <span>Item Name</span>
              <input
                required
                placeholder="e.g. Whole milk, baby spinach…"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Quantity</span>
              <input
                required
                placeholder="e.g. 1 carton, 500g"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <div className="quantity-chips">
                {QUANTITY_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={`chip-btn${quantity === chip ? " selected" : ""}`}
                    onClick={() => setQuantity(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </label>
            <label className="form-field">
              <span>Date Added</span>
              <input
                type="date"
                value={dateAdded}
                max={todayISO()}
                onChange={(e) => setDateAdded(e.target.value)}
              />
            </label>
            <label className="form-field">
              <span>Custom Fresh Days <em className="form-hint">optional</em></span>
              <input
                placeholder={`Default: ${CATEGORY_DEFAULTS[category] ?? 7} days for ${category}`}
                value={customFreshDays}
                onChange={(e) => setCustomFreshDays(e.target.value)}
                inputMode="numeric"
              />
            </label>
          </div>

          {/* Opened toggle */}
          <div className="toggle-row" onClick={() => setOpened((v) => !v)}>
            <div className={`toggle-switch${opened ? " on" : ""}`}>
              <div className="toggle-thumb" />
            </div>
            <div className="toggle-text">
              <strong>Already opened</strong>
              <span>Reduces estimated freshness by half</span>
            </div>
          </div>
        </div>

        {/* Freshness preview */}
        <div className={`freshness-preview freshness-preview--${freshnessColor(estimatedDays)}`}>
          <div className="freshness-preview-icon">
            {estimatedDays <= 3 ? "⚠️" : estimatedDays <= 7 ? "🕐" : "✅"}
          </div>
          <div>
            <strong>Estimated fresh for ~{estimatedDays} {estimatedDays === 1 ? "day" : "days"}</strong>
            <p>Expires around {formatExpiry(dateAdded, estimatedDays)}</p>
          </div>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="add-item-actions">
          <button type="button" className="button ghost" onClick={() => navigate("/")}>
            Cancel
          </button>
          <button className="button" disabled={saving || !name || !quantity}>
            {saving ? "Saving…" : "Add to Inventory"}
          </button>
        </div>
      </form>
    </section>
  );
}
