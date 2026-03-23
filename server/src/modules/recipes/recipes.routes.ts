import { Router } from "express";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "../../db.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireHousehold } from "../../middleware/auth.js";
import { refreshAndPersistItem } from "../items/items.service.js";
import { env } from "../../config/env.js";

interface RecipeEntry {
  name: string;
  ingredients: string[];
  shortSteps: string[];
  timeEstimate: string;
}

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  usedIngredients: { name: string }[];
  missedIngredientCount: number;
}

function tokenizeIngredientCandidates(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1);
}

export const recipesRouter = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const jsonPath = resolve(__dirname, "../../data/recipes.json");
const localRecipes: RecipeEntry[] = (JSON.parse(readFileSync(jsonPath, "utf8")) as RecipeEntry[]).map((r) => ({
  ...r,
  ingredients: r.ingredients.map((i) => i.toLowerCase())
}));

recipesRouter.get(
  "/suggestions",
  requireAuth,
  requireHousehold,
  asyncHandler(async (req, res) => {
    const activeItems = await prisma.item.findMany({
      where: {
        householdId: req.membership!.householdId,
        archivedAt: null
      }
    });

    const refreshed = await Promise.all(activeItems.map((item) => refreshAndPersistItem(prisma, item)));
    const useSoon = refreshed.filter((item) => item.status === "USE_SOON");
    const keywords = new Set<string>();
    for (const item of useSoon) {
      tokenizeIngredientCandidates(item.name).forEach((part) => keywords.add(part));
      keywords.add(item.category.toLowerCase());
    }

    if (keywords.size === 0) {
      res.json({ suggestions: [] });
      return;
    }

    if (env.SPOONACULAR_API_KEY) {
      const ingredientList = Array.from(keywords).join(",");
      const url = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(ingredientList)}&number=6&ranking=1&ignorePantry=true&apiKey=${env.SPOONACULAR_API_KEY}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Spoonacular API error: ${response.status}`);
      }
      const data = (await response.json()) as SpoonacularRecipe[];
      const suggestions = data.map((recipe) => ({
        name: recipe.title,
        image: recipe.image,
        sourceUrl: `https://spoonacular.com/recipes/${recipe.title.toLowerCase().replace(/\s+/g, "-")}-${recipe.id}`,
        matchedIngredients: recipe.usedIngredients.map((i) => i.name),
        shortSteps: [] as string[],
        timeEstimate: ""
      }));
      res.json({ suggestions });
      return;
    }

    // Fallback to local recipes
    const suggestions = localRecipes
      .map((recipe) => {
        const matchedIngredients = recipe.ingredients.filter((ingredient) =>
          keywords.has(ingredient)
        );
        return {
          ...recipe,
          matchedIngredients,
          matchCount: matchedIngredients.length
        };
      })
      .filter((recipe) => recipe.matchCount > 0)
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, 6)
      .map((recipe) => ({
        name: recipe.name,
        image: null,
        sourceUrl: null,
        matchedIngredients: recipe.matchedIngredients,
        shortSteps: recipe.shortSteps,
        timeEstimate: recipe.timeEstimate
      }));

    res.json({ suggestions });
  })
);
