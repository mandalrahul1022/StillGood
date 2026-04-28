import { useState, useEffect } from "react";

/* ────────── types ────────── */

interface Recipe {
  id?: number;
  title: string;
  usesItems: string[];
  estimatedSavings?: number;
  prepTime?: string;
}

/* ────────── fallback data ────────── */

const PLACEHOLDERS: Recipe[] = [
  {
    title: "Pasta al Tonno",
    usesItems: ["Tuna (opened)", "Pasta", "Olive Oil"],
    prepTime: "20 min",
    estimatedSavings: 6.8,
  },
  {
    title: "Vegetable Frittata",
    usesItems: ["Eggs", "Bell Pepper (opened)", "Milk"],
    prepTime: "15 min",
    estimatedSavings: 4.2,
  },
  {
    title: "Yogurt Parfait",
    usesItems: ["Greek Yogurt (2 days left)", "Granola"],
    prepTime: "5 min",
    estimatedSavings: 3.1,
  },
];

/* ────────── recipe card ────────── */

function RecipeCard({ recipe }: { recipe: Recipe }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-emerald-800 transition-colors cursor-pointer flex flex-col gap-3 min-w-[260px] snap-start">
      <p className="text-white font-semibold">{recipe.title}</p>

      {/* item badges */}
      <div>
        <p className="text-zinc-500 text-xs mb-1.5">Uses items expiring soon:</p>
        <div className="flex flex-wrap gap-1.5">
          {recipe.usesItems.map((item) => (
            <span
              key={item}
              className="bg-amber-900/30 text-amber-300 text-xs px-2 py-0.5 rounded-full border border-amber-800/40"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* bottom row */}
      <div className="flex items-center justify-between mt-auto pt-1 text-xs">
        {recipe.prepTime && <span className="text-zinc-500">{recipe.prepTime}</span>}
        {recipe.estimatedSavings != null && (
          <span className="text-emerald-400 font-medium">
            Saves ~${recipe.estimatedSavings.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );
}

/* ────────── main component ────────── */

export default function RecipeSuggestions() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/recipes/suggestions", {
          credentials: "include",
        });
        if (res.ok) {
          const data: Recipe[] = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            setRecipes(data);
            return;
          }
        }
      } catch {
        /* endpoint may not exist yet — fall through to placeholders */
      } finally {
        setLoading(false);
      }
      setRecipes(PLACEHOLDERS);
    })();
  }, []);

  /* ── skeleton ── */
  if (loading) {
    return (
      <div className="mb-6 animate-pulse">
        <div className="h-5 bg-zinc-800 rounded w-56 mb-2" />
        <div className="h-3 bg-zinc-800/60 rounded w-44 mb-4" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-3">
              <div className="h-4 bg-zinc-800 rounded w-3/4" />
              <div className="h-3 bg-zinc-800/60 rounded w-1/2" />
              <div className="flex gap-1.5">
                <div className="h-5 bg-zinc-800 rounded-full w-16" />
                <div className="h-5 bg-zinc-800 rounded-full w-12" />
              </div>
              <div className="h-3 bg-zinc-800/60 rounded w-1/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse mr-2 shrink-0" />
            <h3 className="text-xl font-bold text-white">Use These Before They Expire</h3>
          </div>
          <p className="text-zinc-400 text-sm mt-0.5 ml-4">
            Recipes that use your expiring items
          </p>
        </div>
        <button className="text-emerald-400 text-sm hover:text-emerald-300 transition-colors shrink-0 mt-1">
          See all
        </button>
      </div>

      {/* cards — horizontal scroll on mobile, 3‑col grid on desktop */}
      <div className="flex overflow-x-auto gap-4 snap-x snap-mandatory pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:snap-none sm:pb-0">
        {recipes.map((r, i) => (
          <RecipeCard key={r.id ?? i} recipe={r} />
        ))}
      </div>
    </div>
  );
}
