import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Item, RecipeSuggestion } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../auth/AuthProvider";

export function DashboardPage() {
  const { household } = useAuth();
  const [statusFilter, setStatusFilter] = useState<"active" | "archived">("active");
  const [items, setItems] = useState<Item[]>([]);
  const [suggestions, setSuggestions] = useState<RecipeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!household) {
      return;
    }
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

  const stats = useMemo(() => {
    const fresh = items.filter((item) => item.status === "FRESH").length;
    const useSoon = items.filter((item) => item.status === "USE_SOON").length;
    const expired = items.filter((item) => item.status === "EXPIRED").length;
    return { fresh, useSoon, expired };
  }, [items]);

  const runItemAction = async (action: () => Promise<void>) => {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  const quickEdit = async (item: Item) => {
    const nextName = window.prompt("Item name", item.name);
    if (nextName === null) {
      return;
    }
    const nextQuantity = window.prompt("Quantity", item.quantity);
    if (nextQuantity === null) {
      return;
    }
    const nextCustomDays = window.prompt(
      "Custom fresh days (blank for none)",
      item.customFreshDays?.toString() ?? ""
    );
    if (nextCustomDays === null) {
      return;
    }

    const customFreshDays = nextCustomDays.trim() === "" ? null : Number(nextCustomDays.trim());
    await runItemAction(async () => {
      await api.updateItem(item.id, {
        name: nextName,
        quantity: nextQuantity,
        customFreshDays: Number.isNaN(customFreshDays) ? null : customFreshDays
      });
    });
  };

  if (!household) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>Join or create a household</h2>
          <p>Shared household inventory unlocks item tracking, alerts, and analytics.</p>
        </div>
        <HouseholdSetup />
      </section>
    );
  }

  return (
    <section className="stack">
      <section className="panel dashboard-hero">
        <div>
          <h2>Inventory Overview</h2>
          <p>Monitor freshness in real time and act before food gets wasted.</p>
        </div>
        <div className="hero-badge">{items.length} active signals</div>
      </section>

      <div className="metric-grid">
        <article className="metric-card">
          <span>Fresh</span>
          <strong>{stats.fresh}</strong>
        </article>
        <article className="metric-card">
          <span>Use Soon</span>
          <strong>{stats.useSoon}</strong>
        </article>
        <article className="metric-card">
          <span>Expired</span>
          <strong>{stats.expired}</strong>
        </article>
      </div>

      <section className="panel">
        <div className="row between">
          <h2>Inventory</h2>
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
        {error ? <p className="error-text">{error}</p> : null}
        {loading ? <p>Loading items...</p> : null}

        {!loading && items.length === 0 ? (
          <EmptyState
            title="No inventory yet"
            description="Add your first item to start freshness tracking."
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Days Left</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.category}</td>
                    <td>{item.quantity}</td>
                    <td>
                      <StatusBadge status={item.status} opened={item.opened} />
                    </td>
                    <td>{item.daysRemaining}</td>
                    <td>
                      <div className="row">
                        {statusFilter === "active" ? (
                          <>
                            <button
                              className="button tiny"
                              disabled={item.opened === true}
                              onClick={() => void runItemAction(() => api.openItem(item.id).then(() => undefined))}
                            >
                              {item.opened === true ? "Opened" : "Open"}
                            </button>
                            <button
                              className="button tiny secondary"
                              onClick={() =>
                                void runItemAction(() => api.consumeItem(item.id).then(() => undefined))
                              }
                            >
                              Consume
                            </button>
                            <button className="button tiny ghost" onClick={() => void quickEdit(item)}>
                              Edit
                            </button>
                          </>
                        ) : null}
                        <button
                          className="button tiny danger"
                          onClick={() =>
                            void runItemAction(() => api.deleteItem(item.id).then(() => undefined))
                          }
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
        )}
      </section>

      {statusFilter === "active" ? (
        <section className="panel">
          <h2>Recipe Ideas for Use Soon Items</h2>
          {suggestions.length === 0 ? (
            <EmptyState
              title="No recipe matches yet"
              description="Use soon items will trigger recipe suggestions here."
            />
          ) : (
            <div className="recipe-grid">
              {suggestions.map((recipe) => (
                <article className="recipe-card" key={recipe.name}>
                  {recipe.image && <img src={recipe.image} alt={recipe.name} className="recipe-image" />}
                  {recipe.sourceUrl ? (
                    <h3><a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer">{recipe.name}</a></h3>
                  ) : (
                    <h3>{recipe.name}</h3>
                  )}
                  <p>Matched: {recipe.matchedIngredients.join(", ")}</p>
                  {recipe.timeEstimate && <p>Time: {recipe.timeEstimate}</p>}
                  {recipe.shortSteps.length > 0 && (
                    <ol>
                      {recipe.shortSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
