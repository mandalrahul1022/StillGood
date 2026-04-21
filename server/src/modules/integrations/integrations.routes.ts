import { Router } from "express";
import { google } from "googleapis";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { requireAuth, requireHousehold } from "../../middleware/auth.js";
import { AppError } from "../../lib/errors.js";
import { env } from "../../config/env.js";
import { prisma } from "../../db.js";
import { GmailScanError, scanGmailForReceipts } from "./gmail.service.js";
import { buildComputedFields, trackEvent } from "../items/items.service.js";

export const integrationsRouter = Router();

/**
 * Gmail OAuth is served from the API host (server). In production the client
 * and server live on different hostnames (e.g. Vercel + Railway), so prefer
 * the explicit SERVER_PUBLIC_URL. In local dev we fall back to swapping the
 * port of CLIENT_ORIGIN (5173 -> 4000).
 */
function getServerOrigin(): string {
  if (env.SERVER_PUBLIC_URL) {
    return env.SERVER_PUBLIC_URL.replace(/\/$/, "");
  }
  try {
    const url = new URL(env.CLIENT_ORIGIN);
    url.port = String(env.PORT);
    return url.origin;
  } catch {
    return `http://localhost:${env.PORT}`;
  }
}

function getOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(503, "GMAIL_NOT_CONFIGURED", "Gmail integration is not configured.");
  }
  const redirectUri = `${getServerOrigin()}/api/integrations/gmail/callback`;
  return new google.auth.OAuth2(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, redirectUri);
}

// GET /integrations/status
integrationsRouter.get(
  "/status",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const integration = await prisma.gmailIntegration.findUnique({ where: { userId } });
    res.json({
      gmail: {
        connected: !!integration,
        email: integration?.gmailEmail ?? null,
        lastSyncAt: integration?.lastSyncAt ?? null,
        configured: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GEMINI_API_KEY)
      }
    });
  })
);

// GET /integrations/gmail/connect
integrationsRouter.get(
  "/gmail/connect",
  requireAuth,
  asyncHandler(async (_req, res) => {
    const oAuth2Client = getOAuthClient();
    const url = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      prompt: "consent",
      scope: [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
      ]
    });
    res.redirect(url);
  })
);

// GET /integrations/gmail/callback
integrationsRouter.get(
  "/gmail/callback",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { code, error } = req.query as { code?: string; error?: string };
    if (error || !code) {
      return res.redirect(`${env.CLIENT_ORIGIN}/integrations?error=access_denied`);
    }

    const oAuth2Client = getOAuthClient();
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!tokens.access_token || !tokens.expiry_date || !profile.email) {
      throw new AppError(502, "OAUTH_INCOMPLETE", "Google did not return a complete token response");
    }

    const userId = req.user!.id;
    const existing = await prisma.gmailIntegration.findUnique({ where: { userId } });

    await prisma.gmailIntegration.upsert({
      where: { userId },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? "",
        expiresAt: new Date(tokens.expiry_date),
        gmailEmail: profile.email
      },
      update: {
        accessToken: tokens.access_token,
        // Google only returns refresh_token on first consent; keep the old one otherwise.
        refreshToken: tokens.refresh_token ?? existing?.refreshToken ?? "",
        expiresAt: new Date(tokens.expiry_date),
        gmailEmail: profile.email
      }
    });

    res.redirect(`${env.CLIENT_ORIGIN}/integrations?connected=gmail`);
  })
);

// POST /integrations/gmail/disconnect
integrationsRouter.post(
  "/gmail/disconnect",
  requireAuth,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    await prisma.gmailIntegration.deleteMany({ where: { userId } });
    res.json({ ok: true });
  })
);

// POST /integrations/gmail/scan
integrationsRouter.post(
  "/gmail/scan",
  requireAuth,
  requireHousehold,
  asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    const householdId = req.membership!.householdId;

    const integration = await prisma.gmailIntegration.findUnique({ where: { userId } });
    if (!integration) {
      throw new AppError(400, "GMAIL_NOT_CONNECTED", "Gmail is not connected.");
    }
    if (!env.GEMINI_API_KEY) {
      throw new AppError(503, "GEMINI_NOT_CONFIGURED", "Gemini API key is not configured.");
    }

    const oAuth2Client = getOAuthClient();
    oAuth2Client.setCredentials({
      access_token: integration.accessToken,
      refresh_token: integration.refreshToken,
      expiry_date: integration.expiresAt.getTime()
    });

    const needsRefresh = integration.expiresAt.getTime() < Date.now() + 60_000;
    if (needsRefresh) {
      if (!integration.refreshToken) {
        throw new AppError(
          401,
          "GMAIL_REAUTH_REQUIRED",
          "Gmail session expired. Please disconnect and reconnect Gmail."
        );
      }
      const { credentials } = await oAuth2Client.refreshAccessToken();
      if (credentials.access_token && credentials.expiry_date) {
        await prisma.gmailIntegration.update({
          where: { userId },
          data: {
            accessToken: credentials.access_token,
            expiresAt: new Date(credentials.expiry_date)
          }
        });
      }
      oAuth2Client.setCredentials(credentials);
    }

    let scannedItems;
    try {
      scannedItems = await scanGmailForReceipts(oAuth2Client, env.GEMINI_API_KEY, {
        lastSyncAt: integration.lastSyncAt
      });
    } catch (err) {
      if (err instanceof GmailScanError) {
        throw new AppError(err.status, err.code, err.message);
      }
      throw err;
    }

    if (scannedItems.length === 0) {
      await prisma.gmailIntegration.update({
        where: { userId },
        data: { lastSyncAt: new Date() }
      });
      return res.json({ added: 0, skipped: 0, items: [] });
    }

    // Skip items that already exist (active, same name) in this household to avoid duplicates.
    const existingNames = new Set(
      (
        await prisma.item.findMany({
          where: { householdId, archivedAt: null },
          select: { name: true }
        })
      ).map((item) => item.name.toLowerCase())
    );

    const toCreate = scannedItems.filter((item) => !existingNames.has(item.name.toLowerCase()));
    const skipped = scannedItems.length - toCreate.length;

    const now = new Date();
    const createdItems = await Promise.all(
      toCreate.map(async (scanned) => {
        // Prefer Gemini's per-food estimate when provided. The freshness
        // engine treats customFreshDays as an explicit override, so this
        // effectively gives each recognized item its own timeline instead
        // of the broad category rule.
        const customFreshDays = scanned.freshDays ?? null;
        const computed = await buildComputedFields(prisma, {
          category: scanned.category,
          dateAdded: now,
          opened: false,
          customFreshDays
        });
        return prisma.item.create({
          data: {
            householdId,
            createdByUserId: userId,
            name: scanned.name,
            category: scanned.category,
            quantity: scanned.quantity,
            dateAdded: now,
            opened: false,
            customFreshDays,
            expiresAt: computed.expiresAt,
            daysRemaining: computed.daysRemaining,
            status: computed.status,
            confidence: computed.confidence
          }
        });
      })
    );

    await Promise.all(
      createdItems.map((item) =>
        trackEvent(prisma, {
          householdId,
          itemId: item.id,
          userId,
          type: "ITEM_ADDED",
          meta: { source: "gmail" }
        })
      )
    );

    await prisma.gmailIntegration.update({
      where: { userId },
      data: { lastSyncAt: new Date() }
    });

    res.json({ added: createdItems.length, skipped, items: createdItems });
  })
);
