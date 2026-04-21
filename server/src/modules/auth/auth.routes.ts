import crypto from "node:crypto";
import { Router } from "express";
import bcrypt from "bcryptjs";
import { google } from "googleapis";
import { z } from "zod";
import { prisma } from "../../db.js";
import { env } from "../../config/env.js";
import { AppError } from "../../lib/errors.js";
import { asyncHandler } from "../../lib/asyncHandler.js";
import { validate } from "../../middleware/validate.js";
import {
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken
} from "../../middleware/auth.js";

const registerSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    name: z.string().min(2),
    householdName: z.string().min(2).max(80).optional(),
    prefsEmail: z.boolean().optional(),
    prefsInApp: z.boolean().optional()
  }),
  params: z.object({}),
  query: z.object({})
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8)
  }),
  params: z.object({}),
  query: z.object({})
});

const updateProfileSchema = z.object({
  body: z
    .object({
      name: z.string().min(2).max(80).optional(),
      householdName: z.string().max(80).nullable().optional(),
      prefsEmail: z.boolean().optional(),
      prefsInApp: z.boolean().optional()
    })
    .refine((value) => Object.keys(value).length > 0, {
      message: "At least one field must be updated"
    }),
  params: z.object({}),
  query: z.object({})
});

function sanitizeUser(user: {
  id: string;
  email: string;
  name: string;
  householdName: string | null;
  prefsEmail: boolean;
  prefsInApp: boolean;
  createdAt?: Date;
}) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    householdName: user.householdName,
    prefsEmail: user.prefsEmail,
    prefsInApp: user.prefsInApp,
    createdAt: user.createdAt
  };
}

export const authRouter = Router();

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { email, password, name, householdName, prefsEmail, prefsInApp } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, "EMAIL_IN_USE", "Email is already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        householdName,
        prefsEmail: prefsEmail ?? false,
        prefsInApp: prefsInApp ?? true
      }
    });

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.status(201).json({
      user: sanitizeUser(user)
    });
  })
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    res.json({
      user: sanitizeUser(user)
    });
  })
);

authRouter.post(
  "/logout",
  asyncHandler(async (_req, res) => {
    clearAuthCookie(res);
    res.status(204).send();
  })
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const membership = await prisma.householdMember.findFirst({
      where: { userId: req.user!.id },
      include: { household: true },
      orderBy: { createdAt: "asc" }
    });

    res.json({
      user: sanitizeUser(req.user!),
      household: membership
        ? {
            id: membership.household.id,
            name: membership.household.name,
            inviteCode: membership.household.inviteCode,
            role: membership.role
          }
        : null
    });
  })
);

authRouter.patch(
  "/me",
  requireAuth,
  validate(updateProfileSchema),
  asyncHandler(async (req, res) => {
    const updated = await prisma.user.update({
      where: { id: req.user!.id },
      data: {
        name: req.body.name,
        householdName: req.body.householdName,
        prefsEmail: req.body.prefsEmail,
        prefsInApp: req.body.prefsInApp
      }
    });

    res.json({ user: sanitizeUser(updated) });
  })
);

/* -------------------------------------------------------------------------- */
/*                         Google Sign-In (OAuth 2.0)                         */
/* -------------------------------------------------------------------------- */

/**
 * OAuth redirect URI. Must point at the *client* origin (e.g. the Vercel
 * domain) — not the server — because the auth cookie we issue at the end of
 * the callback has to be first-party for the browser the user is actually
 * using. The Vercel rewrite in client/vercel.json forwards /api/* to the
 * Railway server transparently. Matches the Gmail integration's strategy.
 */
function getGoogleLoginRedirectUri(): string {
  return `${env.CLIENT_ORIGIN.replace(/\/$/, "")}/api/auth/google/callback`;
}

function getGoogleLoginOAuthClient() {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new AppError(
      503,
      "GOOGLE_LOGIN_NOT_CONFIGURED",
      "Google sign-in is not configured."
    );
  }
  return new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    getGoogleLoginRedirectUri()
  );
}

const GOOGLE_STATE_COOKIE = "stillgood_google_state";
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * GET /auth/google/start — kicks off the OAuth consent flow.
 *
 * The `state` parameter is a short random token also written to a short-lived
 * httpOnly cookie; on the callback we require the two to match, which stops
 * attackers from tricking a logged-in user into accepting someone else's
 * Google grant. `returnTo` lets the client request a redirect target after
 * login, restricted to same-origin paths to prevent open-redirect abuse.
 */
authRouter.get(
  "/google/start",
  asyncHandler(async (req, res) => {
    const oAuth2Client = getGoogleLoginOAuthClient();
    const state = crypto.randomBytes(16).toString("hex");

    const rawReturnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : "/";
    const safeReturnTo = rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//")
      ? rawReturnTo
      : "/";

    const isProd = env.NODE_ENV === "production";
    res.cookie(GOOGLE_STATE_COOKIE, `${state}|${safeReturnTo}`, {
      httpOnly: true,
      secure: isProd,
      // `lax` is correct here: the callback is a top-level GET navigation
      // initiated by Google's redirect, which SameSite=Lax allows. `none`
      // would also work but lax is tighter.
      sameSite: isProd ? "none" : "lax",
      maxAge: GOOGLE_STATE_TTL_MS,
      path: "/"
    });

    const url = oAuth2Client.generateAuthUrl({
      access_type: "online",
      prompt: "select_account",
      scope: ["openid", "email", "profile"],
      state
    });
    res.redirect(url);
  })
);

interface GoogleTokenPayload {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

function decodeIdTokenPayload(idToken: string): GoogleTokenPayload {
  const [, payloadB64] = idToken.split(".");
  if (!payloadB64) throw new AppError(502, "OAUTH_INVALID_ID_TOKEN", "Google returned an invalid id_token.");
  const json = Buffer.from(payloadB64.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  return JSON.parse(json) as GoogleTokenPayload;
}

/**
 * GET /auth/google/callback — exchanges the code, finds or creates the user,
 * issues a session cookie, and redirects back to the client app.
 *
 * Account linking: if an email/password user already exists with the same
 * Google email, we backfill `googleId` on that existing row so they can use
 * either method going forward.
 */
authRouter.get(
  "/google/callback",
  asyncHandler(async (req, res) => {
    const errorRedirect = (reason: string) =>
      res.redirect(`${env.CLIENT_ORIGIN.replace(/\/$/, "")}/login?error=${encodeURIComponent(reason)}`);

    const { code, state: stateFromQuery, error } = req.query as {
      code?: string;
      state?: string;
      error?: string;
    };

    if (error) return errorRedirect(error);
    if (!code || !stateFromQuery) return errorRedirect("missing_code");

    const rawCookie = req.cookies?.[GOOGLE_STATE_COOKIE] as string | undefined;
    res.clearCookie(GOOGLE_STATE_COOKIE, { path: "/" });
    if (!rawCookie) return errorRedirect("state_expired");
    const [expectedState, returnToPath = "/"] = rawCookie.split("|");
    if (!expectedState || expectedState !== stateFromQuery) {
      return errorRedirect("state_mismatch");
    }

    const oAuth2Client = getGoogleLoginOAuthClient();
    let tokens;
    try {
      const result = await oAuth2Client.getToken(code);
      tokens = result.tokens;
    } catch {
      return errorRedirect("token_exchange_failed");
    }

    if (!tokens.id_token) return errorRedirect("no_id_token");

    let payload: GoogleTokenPayload;
    try {
      payload = decodeIdTokenPayload(tokens.id_token);
    } catch {
      return errorRedirect("id_token_decode_failed");
    }

    if (!payload.email || !payload.sub) return errorRedirect("missing_profile");
    if (payload.email_verified === false) return errorRedirect("email_not_verified");

    const email = payload.email.toLowerCase();
    const displayName = payload.name || payload.given_name || email.split("@")[0];

    // 1. Exact match by googleId — returning Google-login user.
    // 2. Fallback to email — existing email/password user linking Google for
    //    the first time; backfill googleId so future logins take path 1.
    // 3. Neither — brand new signup; create with a random password hash
    //    they can never match (Google-only account).
    let user = await prisma.user.findUnique({ where: { googleId: payload.sub } });

    if (!user) {
      const byEmail = await prisma.user.findUnique({ where: { email } });
      if (byEmail) {
        user = await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId: payload.sub }
        });
      }
    }

    if (!user) {
      const randomPassword = crypto.randomBytes(24).toString("hex");
      const passwordHash = await bcrypt.hash(randomPassword, 10);
      user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          googleId: payload.sub,
          name: displayName,
          prefsEmail: false,
          prefsInApp: true
        }
      });
    }

    const token = signToken(user.id);
    setAuthCookie(res, token);

    const safeReturnTo =
      returnToPath.startsWith("/") && !returnToPath.startsWith("//") ? returnToPath : "/";
    res.redirect(`${env.CLIENT_ORIGIN.replace(/\/$/, "")}${safeReturnTo}`);
  })
);
