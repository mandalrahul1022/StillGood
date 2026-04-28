# StillGood

StillGood is a full-stack prototype for reducing household food waste. It tracks freshness of items in your pantry/fridge, raises "use soon" alerts, suggests recipes from expiring items, and can ingest groceries directly from Gmail receipts or a scanned paper receipt.

## Scope
- Included: authentication, household inventory, freshness engine, alerts, recipes, analytics, Gmail receipt integration, receipt scanner (image upload).
- Explicitly out of scope: FreshEye hardware integration (text-only placeholder only).

## Tech Stack
- Frontend: React + TypeScript + Vite
- Backend: Node.js + TypeScript + Express
- Database: SQLite + Prisma schema/client
- Auth: email/password, bcrypt hashing, JWT HttpOnly cookie session
- Integrations:
  - Gmail API via `googleapis` (OAuth2) for receipt ingestion
  - Google Gemini (`gemini-2.5-flash-lite` by default) for extracting grocery items from receipt bodies
  - TabScanner (optional) for OCR on uploaded receipt images
  - Spoonacular (optional) for richer recipe suggestions
- Monorepo: `client/` and `server/` via pnpm workspaces

## Project Structure
```text
.
├── client
│   └── src
├── server
│   ├── prisma
│   │   ├── schema.prisma
│   │   ├── migrations
│   │   └── seed.ts
│   ├── scripts
│   ├── src
│   └── tests
├── package.json
└── pnpm-workspace.yaml
```

## Prerequisites
- Node.js 22+ (tested in this workspace with Node 24)
- pnpm

If pnpm is missing:
```bash
npm install -g pnpm
```

## Install
```bash
pnpm install
```

## Configure Environment
Create `server/.env` from `server/.env.example`. The core variables are:
```bash
DATABASE_URL="file:./dev.db"
JWT_SECRET="dev-only-secret"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

Optional integrations — add only the ones you want to enable:
```bash
# Gmail receipt scanning (required for /integrations/gmail/*)
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Gemini item extraction (required when Gmail is enabled)
GEMINI_API_KEY="..."
# Optional override; defaults to gemini-2.5-flash-lite which fits the free tier
GEMINI_MODEL="gemini-2.5-flash-lite"

# Receipt image OCR (optional; enables POST /api/receipts/scan)
TABSCANNER_API_KEY="..."

# Recipe suggestions (optional; falls back to built-in suggestions if unset)
SPOONACULAR_API_KEY="..."

# Optional: kept for backwards compatibility. No longer required for the
# OAuth flows — both Google sign-in and the Gmail integration now route
# their callbacks through CLIENT_ORIGIN (via the Vercel /api/* rewrite),
# which keeps the auth cookie first-party in all browsers.
# SERVER_PUBLIC_URL="https://your-server.up.railway.app"
```

### Setting up the Google OAuth client
1. In Google Cloud Console, create an OAuth 2.0 Client ID of type "Web application".
2. Add these URIs to **Authorized redirect URIs**:
   - Local dev:
     - `http://localhost:5173/api/auth/google/callback`
     - `http://localhost:4000/api/integrations/gmail/callback`
   - Production (replace `<client>` with your deployed client domain, e.g. `stillgood1.vercel.app`):
     - `https://<client>/api/auth/google/callback`
     - `https://<client>/api/integrations/gmail/callback`

   Both callbacks intentionally live on the client domain — the client (Vercel) transparently forwards `/api/*` to the server, which keeps the auth cookie first-party and lets both Google sign-in and Gmail connect work across browsers that block third-party cookies.
3. Enable the **Gmail API** and **Generative Language API** for the project.
4. Paste the client ID/secret into `server/.env` and restart `pnpm dev`.
5. The same OAuth client is used for both Google sign-in (`openid email profile` scopes) and the Gmail receipt integration (`gmail.readonly userinfo.email` scopes). Google will prompt for each scope set separately the first time a user uses that feature.

## Deploying (Vercel client + Railway server)
The server is a Node/Express app intended for a container host (Railway,
Fly.io, Render, etc.); the client is a static Vite build intended for Vercel.

**Railway — server service**
- `NODE_ENV=production`
- `CLIENT_ORIGIN` — the full Vercel URL, e.g. `https://stillgood.vercel.app`, no trailing slash. CORS + the auth cookie + both OAuth callback URIs depend on an exact match.
- `JWT_SECRET` — any strong random string.
- `DATABASE_URL` — SQLite is fine but the container filesystem is ephemeral; point this at a path inside an attached Railway volume (e.g. `file:/data/prod.db`) or migrate to a managed DB.
- `PORT` — Railway injects this automatically; don't hard-code it.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, plus optional `GEMINI_MODEL`, `TABSCANNER_API_KEY`, `SPOONACULAR_API_KEY`.

**Vercel — client project**
- No env vars required if you're using the `/api/*` rewrite in `client/vercel.json` (recommended — it makes API calls same-origin, which fixes third-party cookie blocking in Safari/Brave/Chrome Incognito).
- `VITE_API_URL` — **only** set this if you explicitly want the client to bypass the rewrite and hit the server origin directly (e.g. `https://stillgood-server.up.railway.app/api`). Baked in at build time, so redeploy after changing.

The `client/vercel.json` rewrite is:
```json
{
  "rewrites": [
    { "source": "/api/:path*", "destination": "https://<server-host>/api/:path*" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

In prod the auth cookie is issued with `SameSite=None; Secure`, so both hosts must be HTTPS (both Vercel and Railway are by default).

## Database Setup
1. Apply migrations (includes the `GmailIntegration` table):
```bash
pnpm --filter server prisma:migrate
```
2. Seed sample data:
```bash
pnpm --filter server prisma:seed
```

The seed script creates a demo user. Credentials are printed in the seed output — register your own account for real testing.

## Run (Client + Server)
```bash
pnpm dev
```

- Client: `http://localhost:5173`
- Server API: `http://localhost:4000/api`

## Scripts
- Lint all:
```bash
pnpm -r lint
```
- Test all:
```bash
pnpm -r test
```
- Build all:
```bash
pnpm -r build
```

## Implemented API Endpoints

### Auth
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me`
- `GET /api/auth/google/start` — starts the Google sign-in OAuth flow (optional `?returnTo=/path`)
- `GET /api/auth/google/callback` — Google OAuth callback; finds/creates the user, sets the session cookie, redirects into the app

### Households
- `POST /api/households`
- `POST /api/households/join`
- `GET /api/households/me`
- `POST /api/households/invite`
- `GET /api/households/members`
- `DELETE /api/households/members/:userId` (owner only)

### Items
- `GET /api/items?status=active|archived`
- `POST /api/items`
- `PATCH /api/items/:id`
- `DELETE /api/items/:id`
- `POST /api/items/:id/open`
- `POST /api/items/:id/consume`

### Alerts
- `GET /api/alerts`
- `POST /api/alerts/:id/read`
- `POST /api/alerts/run`

### Analytics
- `GET /api/analytics/summary`
- `GET /api/analytics/history?range=week|month`

### Recipes
- `GET /api/recipes/suggestions`

### Receipts (image upload)
- `POST /api/receipts/scan` — multipart upload of a receipt image; returns parsed items (TabScanner)

### Integrations (Gmail)
- `GET /api/integrations/status` — per-integration configured/connected flags + `lastSyncAt`
- `GET /api/integrations/gmail/connect` — starts the OAuth consent flow
- `GET /api/integrations/gmail/callback` — OAuth redirect handler
- `POST /api/integrations/gmail/disconnect`
- `POST /api/integrations/gmail/scan` — pulls recent receipt emails, runs Gemini extraction, and creates items

## Gmail Scanner Notes
- Scans use a rolling `newer_than:Nd` window derived from the last sync time, with an in-memory `internalDate` filter so you can trigger multiple scans per day without re-ingesting the same emails.
- A 10 minute safety window is subtracted from `lastSyncAt` at query time to absorb Gmail's indexing lag.
- Gemini requests are throttled (4s spacing, max 8 messages per scan) and a single 429 retry honors Google's `retryDelay` hint. If quota still runs out mid-scan, items extracted so far are saved and returned.
- Quota / auth failures surface to the UI as `GEMINI_QUOTA_EXCEEDED`, `GEMINI_UNAUTHORIZED`, or `GEMINI_FAILED` instead of a silent "no new receipts".

## Testing Coverage
- Freshness engine unit tests:
  - opened vs unopened logic
  - custom override logic
  - no-extension clamp on open
  - status thresholds
  - confidence heuristic
- Basic API integration tests:
  - auth session flow
  - unauthorized protection
  - items lifecycle flow
  - manual alert run + mark read
