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
# OAuth redirect; must match the URI registered in Google Cloud Console
GOOGLE_REDIRECT_URI="http://localhost:4000/api/integrations/gmail/callback"

# Gemini item extraction (required when Gmail is enabled)
GEMINI_API_KEY="..."
# Optional override; defaults to gemini-2.5-flash-lite which fits the free tier
GEMINI_MODEL="gemini-2.5-flash-lite"

# Receipt image OCR (optional; enables POST /api/receipts/scan)
TABSCANNER_API_KEY="..."

# Recipe suggestions (optional; falls back to built-in suggestions if unset)
SPOONACULAR_API_KEY="..."
```

### Setting up the Google OAuth client
1. In Google Cloud Console, create an OAuth 2.0 Client ID of type "Web application".
2. Add `http://localhost:4000/api/integrations/gmail/callback` as an authorized redirect URI.
3. Enable the **Gmail API** and **Generative Language API** for the project.
4. Paste the client ID/secret into `server/.env` and restart `pnpm dev`.

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
