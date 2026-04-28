import { useState, useEffect, useRef } from "react";

/* ────────── types ────────── */

interface SummaryResponse {
  itemsSaved: number;
  itemsWasted: number;
  totalItems: number;
  savingsEstimateUsd?: number;
}

/* ────────── constants ────────── */

const AVG_ITEM_VALUE = 3.4; // USDA average per item
const AVG_HOUSEHOLD_MONTHLY = 243; // $2913/yr ÷ 12
const COUNT_DURATION = 1200;
const COUNT_INTERVAL = 50;

/* ────────── animated counter hook ────────── */

function useCountUp(target: number, duration = COUNT_DURATION) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (target <= 0) {
      setDisplay(0);
      return;
    }

    const steps = Math.ceil(duration / COUNT_INTERVAL);
    const increment = target / steps;
    let current = 0;
    let step = 0;

    const tick = () => {
      step++;
      current = step >= steps ? target : increment * step;
      setDisplay(current);
      if (step < steps) {
        rafRef.current = window.setTimeout(tick, COUNT_INTERVAL) as unknown as number;
      }
    };

    tick();
    return () => {
      if (rafRef.current !== null) clearTimeout(rafRef.current);
    };
  }, [target, duration]);

  return display;
}

/* ────────── component ────────── */

export default function AnalyticsSummary() {
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/analytics/summary", {
          credentials: "include",
        });
        if (res.ok) setData(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* derived values */
  const itemsSaved = data?.itemsSaved ?? 0;
  const itemsWasted = data?.itemsWasted ?? 0;
  const savings =
    data?.savingsEstimateUsd != null
      ? data.savingsEstimateUsd
      : itemsSaved * AVG_ITEM_VALUE;
  const wasteReduction =
    itemsSaved + itemsWasted > 0
      ? (itemsSaved / (itemsSaved + itemsWasted)) * 100
      : 0;

  /* animated dollar counter */
  const animatedSavings = useCountUp(loading ? 0 : savings);

  /* ── loading skeleton ── */
  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 border-t-2 border-t-emerald-500/30 rounded-xl p-6 mb-6 animate-pulse">
        <div className="h-4 bg-zinc-800 rounded w-3/4 mb-5" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 bg-zinc-800 rounded w-24" />
              <div className="h-3 bg-zinc-800 rounded w-20" />
              <div className="h-3 bg-zinc-800/60 rounded w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const cards: {
    value: string;
    color: string;
    label: string;
    sub: string;
  }[] = [
    {
      value: `$${animatedSavings.toFixed(2)}`,
      color: "text-emerald-400",
      label: "Estimated Saved",
      sub: "this month",
    },
    {
      value: String(itemsSaved),
      color: "text-white",
      label: "Items Consumed",
      sub: "before expiry",
    },
    {
      value: String(itemsWasted),
      color: "text-red-400",
      label: "Items Wasted",
      sub: "expired unused",
    },
    {
      value: `${wasteReduction.toFixed(0)}%`,
      color: "text-amber-400",
      label: "Waste Reduction",
      sub: "vs. avg household",
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 border-t-2 border-t-emerald-500/30 rounded-xl p-6 mb-6">
      {/* context line */}
      <p className="text-zinc-300 text-sm mb-5 leading-relaxed">
        Still Good has helped you save an estimated{" "}
        <span className="font-semibold text-emerald-400">
          ${savings.toFixed(2)}
        </span>{" "}
        this month. The average American household wastes ${AVG_HOUSEHOLD_MONTHLY}/month.
        You're doing better.
      </p>

      {/* stat cards row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="space-y-1">
            <p className={`text-3xl font-bold ${c.color} tabular-nums`}>
              {c.value}
            </p>
            <p className="text-zinc-400 text-sm">{c.label}</p>
            <p className="text-zinc-600 text-xs">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
