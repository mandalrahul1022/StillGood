import bcrypt from "bcryptjs";
import prismaPkg from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const { PrismaClient } = prismaPkg;

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({
    url: databaseUrl
  })
});

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function calcStatus(
  expiresAt: Date,
  now: Date
): { status: "FRESH" | "USE_SOON" | "EXPIRED"; daysRemaining: number } {
  const dayDiff = Math.floor((utcDay(expiresAt).getTime() - utcDay(now).getTime()) / 86_400_000);
  if (dayDiff < 0) {
    return { status: "EXPIRED", daysRemaining: dayDiff };
  }
  if (dayDiff <= 2) {
    return { status: "USE_SOON", daysRemaining: dayDiff };
  }
  return { status: "FRESH", daysRemaining: dayDiff };
}

async function main() {
  await prisma.analyticsEvent.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.item.deleteMany();
  await prisma.householdMember.deleteMany();
  await prisma.household.deleteMany();
  await prisma.user.deleteMany();
  await prisma.freshnessRule.deleteMany();

  const rules = [
    { category: "dairy", unopenedDays: 7, openedDays: 4 },
    { category: "produce", unopenedDays: 5, openedDays: 3 },
    { category: "meat", unopenedDays: 3, openedDays: 2 },
    { category: "leftovers", unopenedDays: 4, openedDays: 2 },
    { category: "bread", unopenedDays: 7, openedDays: 5 },
    { category: "beverages", unopenedDays: 14, openedDays: 7 },
    { category: "grains", unopenedDays: 180, openedDays: 60 },
    { category: "snacks", unopenedDays: 60, openedDays: 14 },
    { category: "condiments", unopenedDays: 180, openedDays: 60 },
    { category: "frozen", unopenedDays: 60, openedDays: 14 },
    { category: "other", unopenedDays: 14, openedDays: 7 }
  ];

  for (const rule of rules) {
    await prisma.freshnessRule.create({ data: rule });
  }

  const passwordHash = await bcrypt.hash("Demo123!", 10);
  const demoUser = await prisma.user.create({
    data: {
      email: "demo@stillgood.local",
      passwordHash,
      name: "Demo User",
      householdName: "StillGood Home",
      prefsEmail: true,
      prefsInApp: true
    }
  });

  const household = await prisma.household.create({
    data: {
      name: "StillGood Home",
      inviteCode: "STILLGOOD"
    }
  });

  await prisma.householdMember.create({
    data: {
      householdId: household.id,
      userId: demoUser.id,
      role: "OWNER"
    }
  });

  const now = new Date();

  const milkAdded = addDays(now, -4);
  const milkExpires = addDays(utcDay(milkAdded), 7);
  const milkStatus = calcStatus(milkExpires, now);

  const spinachAdded = addDays(now, -4);
  const spinachOpened = addDays(now, -1);
  const spinachExpires = addDays(utcDay(spinachOpened), 3);
  const spinachStatus = calcStatus(spinachExpires, now);

  const leftoversAdded = addDays(now, -5);
  const leftoversOpened = addDays(now, -3);
  const leftoversExpires = addDays(utcDay(leftoversOpened), 2);
  const leftoversStatus = calcStatus(leftoversExpires, now);

  const items = await prisma.$transaction([
    prisma.item.create({
      data: {
        householdId: household.id,
        createdByUserId: demoUser.id,
        name: "Milk",
        category: "dairy",
        quantity: "1 carton",
        dateAdded: milkAdded,
        opened: false,
        expiresAt: milkExpires,
        daysRemaining: milkStatus.daysRemaining,
        status: milkStatus.status,
        confidence: 0.9
      }
    }),
    prisma.item.create({
      data: {
        householdId: household.id,
        createdByUserId: demoUser.id,
        name: "Spinach",
        category: "produce",
        quantity: "1 bag",
        dateAdded: spinachAdded,
        opened: true,
        openedAt: spinachOpened,
        expiresAt: spinachExpires,
        daysRemaining: spinachStatus.daysRemaining,
        status: spinachStatus.status,
        confidence: 0.9
      }
    }),
    prisma.item.create({
      data: {
        householdId: household.id,
        createdByUserId: demoUser.id,
        name: "Pasta leftovers",
        category: "leftovers",
        quantity: "2 servings",
        dateAdded: leftoversAdded,
        opened: true,
        openedAt: leftoversOpened,
        expiresAt: leftoversExpires,
        daysRemaining: leftoversStatus.daysRemaining,
        status: leftoversStatus.status,
        confidence: 0.9
      }
    })
  ]);

  const expiredItem = items.find((item) => item.status === "EXPIRED");
  const useSoonItem = items.find((item) => item.status === "USE_SOON");

  if (expiredItem) {
    const alert = await prisma.alert.create({
      data: {
        householdId: household.id,
        userId: demoUser.id,
        itemId: expiredItem.id,
        type: "EXPIRED",
        message: `${expiredItem.name} has expired.`
      }
    });
    await prisma.notificationLog.create({
      data: {
        userId: demoUser.id,
        alertId: alert.id,
        channel: "EMAIL",
        status: "SENT",
        detail: "Prototype email logged to database."
      }
    });
  }

  if (useSoonItem) {
    await prisma.alert.create({
      data: {
        householdId: household.id,
        userId: demoUser.id,
        itemId: useSoonItem.id,
        type: "USE_SOON",
        message: `${useSoonItem.name} should be used soon.`
      }
    });
  }

  const weekStart = utcDay(addDays(now, -6));
  await prisma.analyticsEvent.createMany({
    data: [
      {
        householdId: household.id,
        itemId: items[0].id,
        userId: demoUser.id,
        type: "ITEM_ADDED",
        createdAt: addDays(weekStart, 1)
      },
      {
        householdId: household.id,
        itemId: items[1].id,
        userId: demoUser.id,
        type: "ITEM_ADDED",
        createdAt: addDays(weekStart, 2)
      },
      {
        householdId: household.id,
        itemId: items[1].id,
        userId: demoUser.id,
        type: "ITEM_CONSUMED",
        createdAt: addDays(weekStart, 4)
      },
      {
        householdId: household.id,
        itemId: items[2].id,
        userId: demoUser.id,
        type: "ITEM_EXPIRED",
        createdAt: addDays(weekStart, 5)
      }
    ]
  });

  console.log("Seed complete");
  console.log("Demo credentials: demo@stillgood.local / Demo123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
