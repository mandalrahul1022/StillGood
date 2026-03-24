import { useCallback, useEffect, useState } from "react";
import { AnalyticsEvents, AnalyticsSummary, api } from "../api/client";
import { DonutChart } from "../components/DonutChart";
import { LineChart } from "../components/LineChart";
import { EmptyState } from "../components/EmptyState";
import { HouseholdSetup } from "../components/HouseholdSetup";
import { useAuth } from "../auth/AuthProvider";

const CATEGORY_ICONS: Record<string, string> = {
  produce: "🥦", dairy: "🥛", meat: "🥩", bread: "🍞",
  frozen: "🧊", beverages: "🥤", condiments: "🧴", grains: "🌾",
  snacks: "🍿", leftovers: "🍱", other: "📦"
};

export function AnalyticsPage() {
  const { household } = useAuth();
  const [range, setRange] = useState<"week" | "month">("week");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [events, setEvents] = useState<AnalyticsEvents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    setError(null);
    try {
      const [summaryData, eventsData] = await Promise.all([
        api.analyticsSummary(),
        api.analyticsEvents(range)
      ]);
      setSummary(summaryData);
      setEvents(eventsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [household, range]);

  useEffect(() => { void load(); }, [load]);

  if (!household) {
    return (
      <section className="stack">
        <div className="panel">
          <h2>Create or join a household</h2>
          <p>Analytics are calculated at household level.</p>
        </div>
        <HouseholdSetup />
      </section>
    );
  }

  const maxWasted = events?.topCategoriesWasted[0]?.count ?? 1;

  return (
    <section className="stack">
      <div className="row between">
        <h2>Analytics</h2>
        <select value={range} onChange={(e) => setRange(e.target.value as "week" | "month")}>
          <option value="week">Last 7 days</option>
          <option value="month">Last 30 days</option>
        </select>
      </div>

      {error && <p className="error-text">{error}</p>}
      {loading && <p className="analytics-loading">Loading analytics…</p>}

      {summary && (
        <div className="metric-grid">
          <article className="metric-card">
            <span>Added this week</span>
            <strong>{summary.itemsAddedThisWeek}</strong>
          </article>
          <article className="metric-card">
            <span>Consumed this week</span>
            <strong className="metric-good">{summary.itemsConsumedThisWeek}</strong>
          </article>
          <article className="metric-card">
            <span>Expired this week</span>
            <strong className="metric-bad">{summary.itemsExpiredThisWeek}</strong>
          </article>
          <article className="metric-card">
            <span>Estimated savings</span>
            <strong className="metric-good">${summary.estimatedSavings.toFixed(2)}</strong>
          </article>
        </div>
      )}

      <div className="analytics-charts-row">
        {summary && (
          <DonutChart
            consumed={summary.consumedVsExpired.consumed}
            expired={summary.consumedVsExpired.expired}
          />
        )}

        {events && events.topCategoriesWasted.length > 0 && (
          <section className="panel analytics-categories">
            <h3>Most wasted categories</h3>
            <div className="category-bars">
              {events.topCategoriesWasted.map((entry) => (
                <div key={entry.category} className="category-bar-row">
                  <span className="category-bar-label">
                    {CATEGORY_ICONS[entry.category] ?? "📦"} {entry.category}
                  </span>
                  <div className="category-bar-track">
                    <div
                      className="category-bar-fill"
                      style={{ width: `${(entry.count / maxWasted) * 100}%` }}
                    />
                  </div>
                  <span className="category-bar-count">{entry.count}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {events && events.topCategoriesWasted.length === 0 && (
          <section className="panel analytics-categories">
            <h3>Most wasted categories</h3>
            <EmptyState title="No waste recorded" description="Great job keeping waste low." />
          </section>
        )}
      </div>

      {events && events.series.length > 0 ? (
        <LineChart series={events.series} range={range} />
      ) : (
        !loading && (
          <section className="panel">
            <h3>Trend over time</h3>
            <EmptyState
              title="No trend data yet"
              description="Open, consume, and let items expire to generate trends."
            />
          </section>
        )
      )}
    </section>
  );
}
