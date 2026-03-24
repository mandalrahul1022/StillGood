import { AnalyticsEventType } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import { startOfUtcDay, addUtcDays } from "../../lib/dates.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireHousehold } from "../../middleware/auth.js";
import { validate } from "../../middleware/validate.js";

const categoryCost: Record<string, number> = {
  dairy: 4.5,
  produce: 3.2,
  meat: 7.5,
  leftovers: 5.0,
  other: 3.0
};

const eventRangeSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    range: z.enum(["week", "month"]).default("week")
  })
});

function startDateForRange(range: "week" | "month"): Date {
  const today = startOfUtcDay(new Date());
  if (range === "month") {
    return addUtcDays(today, -29);
  }
  return addUtcDays(today, -6);
}

function getCategoryValue(category: string): number {
  return categoryCost[category.toLowerCase()] ?? categoryCost.other;
}

export const analyticsRouter = Router();

analyticsRouter.get(
  "/summary",
  requireAuth,
  requireHousehold,
  asyncHandler(async (req, res) => {
    const since = startDateForRange("week");
    const householdId = req.membership!.householdId;

    const [addedCount, consumedCount, expiredCount, consumedEvents, expiredEvents] = await Promise.all([
      prisma.analyticsEvent.count({
        where: {
          householdId,
          type: AnalyticsEventType.ITEM_ADDED,
          createdAt: { gte: since }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          householdId,
          type: AnalyticsEventType.ITEM_CONSUMED,
          createdAt: { gte: since }
        }
      }),
      prisma.analyticsEvent.count({
        where: {
          householdId,
          type: AnalyticsEventType.ITEM_EXPIRED,
          createdAt: { gte: since }
        }
      }),
      prisma.analyticsEvent.findMany({
        where: {
          householdId,
          type: AnalyticsEventType.ITEM_CONSUMED,
          createdAt: { gte: since }
        },
        include: {
          item: {
            select: {
              category: true
            }
          }
        }
      }),
      prisma.analyticsEvent.findMany({
        where: {
          householdId,
          type: AnalyticsEventType.ITEM_EXPIRED,
          createdAt: { gte: since }
        },
        include: {
          item: {
            select: {
              category: true
            }
          }
        }
      })
    ]);

    const consumedValue = consumedEvents.reduce(
      (sum, event) => sum + getCategoryValue(event.item?.category ?? "other"),
      0
    );
    const expiredValue = expiredEvents.reduce(
      (sum, event) => sum + getCategoryValue(event.item?.category ?? "other"),
      0
    );
    const estimatedSavings = Number((consumedValue - expiredValue).toFixed(2));

    const topCategoriesMap = new Map<string, number>();
    for (const event of expiredEvents) {
      const category = (event.item?.category ?? "other").toLowerCase();
      topCategoriesMap.set(category, (topCategoriesMap.get(category) ?? 0) + 1);
    }

    const topCategoriesWasted = Array.from(topCategoriesMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    res.json({
      itemsAddedThisWeek: addedCount,
      itemsConsumedThisWeek: consumedCount,
      itemsExpiredThisWeek: expiredCount,
      estimatedSavings,
      consumedVsExpired: {
        consumed: consumedCount,
        expired: expiredCount
      },
      topCategoriesWasted
    });
  })
);

analyticsRouter.get(
  "/history",
  requireAuth,
  requireHousehold,
  validate(eventRangeSchema),
  asyncHandler(async (req, res) => {
    const range = req.query.range as "week" | "month";
    const since = startDateForRange(range);
    const householdId = req.membership!.householdId;

    const events = await prisma.analyticsEvent.findMany({
      where: {
        householdId,
        createdAt: { gte: since },
        type: {
          in: [AnalyticsEventType.ITEM_CONSUMED, AnalyticsEventType.ITEM_EXPIRED]
        }
      },
      include: {
        item: {
          select: {
            category: true
          }
        }
      },
      orderBy: { createdAt: "asc" }
    });

    const byDay = new Map<string, { consumed: number; expired: number }>();
    const wasted = new Map<string, number>();

    for (const event of events) {
      const key = startOfUtcDay(event.createdAt).toISOString().slice(0, 10);
      const row = byDay.get(key) ?? { consumed: 0, expired: 0 };
      if (event.type === AnalyticsEventType.ITEM_CONSUMED) {
        row.consumed += 1;
      } else if (event.type === AnalyticsEventType.ITEM_EXPIRED) {
        row.expired += 1;
        const category = (event.item?.category ?? "other").toLowerCase();
        wasted.set(category, (wasted.get(category) ?? 0) + 1);
      }
      byDay.set(key, row);
    }

    const series = Array.from(byDay.entries()).map(([date, values]) => ({
      date,
      consumed: values.consumed,
      expired: values.expired
    }));

    const topCategoriesWasted = Array.from(wasted.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, count]) => ({ category, count }));

    res.json({
      range,
      series,
      topCategoriesWasted
    });
  })
);
