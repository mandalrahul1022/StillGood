import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, Item, RecipeSuggestion } from "../api/client";
import { CategoryChipRow } from "../components/CategoryChipRow";
import { EditItemModal } from "../components/EditItemModal";
import { EmptyState } from "../components/EmptyState";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { HowItWorks } from "../components/HowItWorks";
import { ImpactStats } from "../components/ImpactStats";
import { ItemCard } from "../components/ItemCard";
import { StatusBadge } from "../components/StatusBadge";
import { Testimonials } from "../components/Testimonials";
import { useAuth } from "../auth/AuthProvider";

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1200&q=80";

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

type ViewMode = "cards" | "table";

function ItemTable({
  items,
  statusFilter,
  onAction,
  onEdit
}: {
  items: Item[];
  statusFilter: "active" | "archived";
  onAction: (action: () => Promise<void>) => Promise<void>;
  onEdit: (item: Item) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Qty</th>
            <th>Status</th>
            <th>Freshness</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className={`row-${item.status.toLowerCase()}`}>
              <td>{item.name}</td>
              <td style={{ textTransform: "capitalize" }}>{item.category}</td>
              <td>{item.quantity}</td>
              <td>
                <StatusBadge status={item.status} opened={item.opened} />
              </td>
              <td>
                <div className="freshness-cell">
                  <span className="freshness-label">{daysLabel(item.daysRemaining)}</span>
                  <div className="freshness-bar">
                    <div
                      className={`freshness-fill ${item.status.toLowerCase()}`}
                      style={{ width: `${freshnessPercent(item.daysRemaining)}%` }}
                    />
                  </div>
                </div>
              </td>
              <td>
                <div className="row">
                  {statusFilter === "active" ? (
                    <>
                      <button
                        className="button tiny"
                        disabled={item.opened === true}
                        onClick={() => void onAction(() => api.openItem(item.id).then(() => undefined))}
                      >
                        {item.opened === true ? "Opened" : "Open"}
                      </button>
                      <button
                        className="button tiny secondary"
                        onClick={() => void onAction(() => api.consumeItem(item.id).then(() => undefined))}
                      >
                        Consume
                      </button>
                      <button className="button tiny ghost" onClick={() => onEdit(item)}>
                        Edit
                      </button>
                    </>
                  ) : null}
                  <button
                    className="button tiny danger"
                    onClick={() => void onAction(() => api.deleteItem(item.id).then(() => undefined))}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function IconGrid() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1.2" fill="currentColor" />
      <circle cx="4" cy="12" r="1.2" fill="currentColor" />
      <circle cx="4" cy="18" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function DashboardPage() {
  const { user, household } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [items, setItems] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    setError(null);
    try {
      const [itemsResponse, recipeResponse] = await Promise.all([
        api.listItems(statusFilter),
        statusFilter === "active" ? api.recipeSuggestions() : Promise.resolve({ suggestions: [] })
      ]);
      setItems(itemsResponse.items);
      setSuggestions(recipeResponse.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [household, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(
    () => ({
      fresh: items.filter((i) => i.status === "FRESH").length,
      useSoon: items.filter((i) => i.status === "USE_SOON").length,
      expired: items.filter((i) => i.status === "EXPIRED").length
    }),
    [items]
  );

  const firstName = user?.name ? user.name.split(" ")[0] : "there";

  const filteredItems = useMemo(() => {
    if (categoryFilter === "all") return items;
    return items.filter((i) => i.category === categoryFilter);
  }, [items, categoryFilter]);

  const grouped = useMemo(
    () => ({
      expired: filteredItems.filter((i) => i.status === "EXPIRED"),
      useSoon: filteredItems.filter((i) => i.status === "USE_SOON"),
      fresh: filteredItems.filter((i) => i.status === "FRESH")
    }),
    [filteredItems]
  );

  const orderedItems = useMemo(
    () => [...grouped.expired, ...grouped.useSoon, ...grouped.fresh],
    [grouped]
  );

  const runItemAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const openEdit = (item: Item) => {
    setError(null);
    setEditingItem(item);
  };

  if (!household) {
    return (
      <section className="stack">
        <div className="page-hero">
          <div className="page-hero-icon">🏡</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <span className="section-eyebrow">Welcome, {firstName}</span>
            <h2>
              Let&rsquo;s set up your <em>household</em>
            </h2>
            <p>Shared household inventory unlocks item tracking, alerts, and analytics across everyone in your kitchen.</p>
          </div>
        </div>
        <HouseholdSetup />
      </section>
    );
  }

  const impactStats = [
    { icon: "🥬", value: String(stats.fresh), label: "Fresh items", tone: "sage" as const },
    { icon: "⏳", value: String(stats.useSoon), label: "Use soon", tone: "honey" as const },
    { icon: "⚠️", value: String(stats.expired), label: "Need attention", tone: "tomato" as const },
    { icon: "🧾", value: String(items.length), label: "Tracked total", tone: "navy" as const }
  ];

  const totalActive = grouped.expired.length + grouped.useSoon.length + grouped.fresh.length;

  return (
    <section className="stack" style={{ gap: 32 }}>
      {/* ── Marketing-style hero ── */}
      <section className="marketing-hero">
        <div className="marketing-hero-grid">
          <div className="marketing-hero-copy">
            <span className="marketing-hero-eyebrow">Welcome back, {firstName}</span>
            <h1>
              Your pantry is <em>still good</em> — <br />
              let&rsquo;s keep it that way.
            </h1>
            <p className="marketing-hero-lede">
              {stats.useSoon + stats.expired > 0
                ? `You have ${stats.useSoon} item${stats.useSoon === 1 ? "" : "s"} to use soon and ${stats.expired} past prime. A few small moves today mean zero waste this week.`
                : "Everything's fresh in the " + household.name + " kitchen. Add new groceries or browse recipe ideas below."}
            </p>

            <div className="marketing-hero-actions">
              <Link className="button" to="/add-item">
                + Add an item
              </Link>
              <Link className="button secondary" to="/scan-receipt">
                🧾 Scan receipt
              </Link>
            </div>

            <div className="marketing-hero-metrics">
              <div className="marketing-hero-metric">
                <strong>{items.length}</strong>
                <span>In your fridge</span>
              </div>
              <div className="marketing-hero-metric">
                <strong>{stats.fresh}</strong>
                <span>Fresh & ready</span>
              </div>
              <div className="marketing-hero-metric">
                <strong>{stats.useSoon + stats.expired}</strong>
                <span>Need attention</span>
              </div>
            </div>
          </div>

          <div
            className="marketing-hero-media"
            style={{ backgroundImage: `url(${HERO_IMAGE})` }}
            aria-hidden
          >
            <div className="marketing-hero-floating-card">
              <div className="float-icon">🔔</div>
              <div className="float-text">
                <strong>{stats.useSoon} item{stats.useSoon === 1 ? "" : "s"} to use soon</strong>
                <span>Check the use-soon tab</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Impact stats bar ── */}
      <ImpactStats stats={impactStats} />

      {/* ── Inventory ── */}
      <section className="panel stack" style={{ gap: 14 }}>
        <div className="row between" style={{ flexWrap: "wrap", gap: 12 }}>
          <div>
            <span className="section-eyebrow sage">Your inventory</span>
            <h2 style={{ marginTop: 8, fontSize: 22 }}>
              {statusFilter === "active" ? "What's in the kitchen" : "Archived items"}
            </h2>
          </div>
          <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
            <div className="view-toggle" role="tablist" aria-label="View mode">
              <button
                className={viewMode === "cards" ? "active" : ""}
                onClick={() => setViewMode("cards")}
                aria-pressed={viewMode === "cards"}
              >
                <IconGrid /> Cards
              </button>
              <button
                className={viewMode === "table" ? "active" : ""}
                onClick={() => setViewMode("table")}
                aria-pressed={viewMode === "table"}
              >
                <IconList /> Table
              </button>
            </div>
            <div className="segmented">
              <button
                className={statusFilter === "active" ? "active" : ""}
                onClick={() => setStatusFilter("active")}
              >
                Active
              </button>
              <button
                className={statusFilter === "archived" ? "active" : ""}
                onClick={() => setStatusFilter("archived")}
              >
                Archived
              </button>
            </div>
          </div>
        </div>

        {statusFilter === "active" && items.length > 0 && (
          <CategoryChipRow
            items={items}
            active={categoryFilter}
            onChange={setCategoryFilter}
          />
        )}

        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p className="subtle">Loading…</p> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No inventory yet"
            description="Add your first item above — or scan a receipt to pull everything in at once."
          />
        ) : !loading && filteredItems.length === 0 ? (
          <EmptyState
            title="Nothing in this category"
            description="Pick another category or tap All to see everything you're tracking."
          />
        ) : viewMode === "cards" && statusFilter === "active" ? (
          <div className="item-card-grid">
            {orderedItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onOpen={(i) =>
                  void runItemAction(() => api.openItem(i.id).then(() => undefined))
                }
                onConsume={(i) =>
                  void runItemAction(() => api.consumeItem(i.id).then(() => undefined))
                }
                onEdit={(i) => openEdit(i)}
                onDelete={(i) =>
                  void runItemAction(() => api.deleteItem(i.id).then(() => undefined))
                }
              />
            ))}
          </div>
        ) : statusFilter === "active" ? (
          <>
            {grouped.expired.length > 0 && (
              <ItemTable
                items={grouped.expired}
                statusFilter={statusFilter}
                onAction={runItemAction}
                onEdit={openEdit}
              />
            )}
            {grouped.useSoon.length > 0 && (
              <ItemTable
                items={grouped.useSoon}
                statusFilter={statusFilter}
                onAction={runItemAction}
                onEdit={openEdit}
              />
            )}
            {grouped.fresh.length > 0 && (
              <ItemTable
                items={grouped.fresh}
                statusFilter={statusFilter}
                onAction={runItemAction}
                onEdit={openEdit}
              />
            )}
          </>
        ) : (
          <ItemTable
            items={items}
            statusFilter={statusFilter}
            onAction={runItemAction}
            onEdit={openEdit}
          />
        )}

        {statusFilter === "active" && totalActive > 0 && (
          <p className="subtle" style={{ fontSize: 12, textAlign: "right", marginTop: 4 }}>
            Showing {filteredItems.length} of {items.length}
            {categoryFilter !== "all" ? ` in ${categoryFilter}` : ""}
          </p>
        )}
      </section>

      {/* ── Recipes ── */}
      {statusFilter === "active" ? (
        <section className="panel">
          <div className="row between" style={{ flexWrap: "wrap", gap: 10 }}>
            <div>
              <span className="section-eyebrow">Cook, don&rsquo;t compost</span>
              <h2 style={{ marginTop: 8, fontSize: 22 }}>Recipe ideas from your kitchen</h2>
              <p style={{ marginTop: 2 }}>
                Pulled from the items closest to their best-by date.
              </p>
            </div>
          </div>

          {suggestions.length === 0 ? (
            <EmptyState
              title="No recipe matches yet"
              description="Use-soon items will trigger tailored recipe suggestions here."
            />
          ) : (
            <div className="recipe-grid">
              {suggestions.map((recipe) => (
                <article className="recipe-card" key={recipe.name}>
                  {recipe.image && (
                    <img src={recipe.image} alt={recipe.name} className="recipe-image" />
                  )}
                  <div className="recipe-card-body">
                    {recipe.sourceUrl ? (
                      <h3>
                        <a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {recipe.name}
                        </a>
                      </h3>
                    ) : (
                      <h3>{recipe.name}</h3>
                    )}
                    <p className="recipe-matched">Uses: {recipe.matchedIngredients.join(", ")}</p>
                    {recipe.timeEstimate && <p className="recipe-time">{recipe.timeEstimate}</p>}
                    {recipe.shortSteps.length > 0 && (
                      <ol className="recipe-steps">
                        {recipe.shortSteps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* ── How it works ── */}
      <HowItWorks />

      {/* ── Testimonials ── */}
      <Testimonials />

      {/* ── CTA band ── */}
      <section className="cta-band">
        <div>
          <h3>Still buying groceries the old way?</h3>
          <p>
            Forward your next supermarket email to StillGood or snap the
            receipt — we&rsquo;ll do the tracking so you can do the cooking.
          </p>
        </div>
        <Link to="/integrations" className="button">
          Connect Gmail →
        </Link>
      </section>

      <EditItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
        onSaved={load}
      />
    </section>
  );
}
