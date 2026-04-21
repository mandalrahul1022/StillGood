import { google, type gmail_v1 } from "googleapis";
import { env } from "../../config/env.js";

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

export interface ScannedGmailItem {
  name: string;
  category: string;
  quantity: string;
  /**
   * Optional per-item freshness hint from Gemini in days. Only set when
   * Gemini recognized a specific food (e.g. "bananas" -> 5). Piped into
   * `customFreshDays` on the Item so it overrides the category rule.
   */
  freshDays?: number;
}

/**
 * Thrown when every Gemini call during a scan fails with the same error.
 * Surfaces meaningful failure reasons (quota, bad key, etc.) to the UI
 * instead of quietly returning "no new receipts".
 */
export class GmailScanError extends Error {
  constructor(
    public readonly status: number,
    public readonly code:
      | "GEMINI_QUOTA_EXCEEDED"
      | "GEMINI_UNAUTHORIZED"
      | "GEMINI_FAILED",
    message: string
  ) {
    super(message);
    this.name = "GmailScanError";
  }
}

/**
 * Gmail query that targets grocery/food-delivery/takeout receipts.
 *
 * We intentionally use `newer_than:Nd` (a rolling time window) rather than
 * `after:<unix>` as a cursor: Gmail's `after:` operator has only day-level
 * granularity when given a Unix timestamp, which makes sub-daily scanning
 * impossible. Precise second-level filtering is done in-process using each
 * message's `internalDate`. The window is sized to cover the gap since
 * `lastSyncAt` with one day of slack for timezone & indexing delay, capped
 * at 60 days to avoid unbounded scans.
 */
function buildGmailQuery(lastSyncAt: Date | null): string {
  const keywords = [
    "subject:receipt",
    'subject:"your order"',
    'subject:"order confirmation"',
    'subject:"order summary"',
    'subject:"your delivery"',
    "from:instacart.com",
    "from:amazon.com",
    "from:wholefoodsmarket.com",
    "from:walmart.com",
    "from:target.com",
    "from:kroger.com",
    "from:sprouts.com",
    "from:costco.com",
    "from:traderjoes.com",
    "from:shipt.com",
    "from:peapod.com",
    "from:gopuff.com",
    "from:freshdirect.com",
    "from:hellofresh.com",
    "from:blueapron.com",
    "from:doordash.com",
    "from:ubereats.com",
    "from:grubhub.com"
  ];
  const or = `(${keywords.join(" OR ")})`;

  if (lastSyncAt) {
    const daysSince = Math.ceil((Date.now() - lastSyncAt.getTime()) / 86_400_000);
    const windowDays = Math.min(60, Math.max(1, daysSince) + 1);
    return `${or} newer_than:${windowDays}d`;
  }
  return `${or} newer_than:60d`;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/** Walks the MIME tree and concatenates text/plain parts (fallback: strip html). */
function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  const textParts: string[] = [];
  const htmlParts: string[] = [];

  const walk = (part: gmail_v1.Schema$MessagePart) => {
    const mime = part.mimeType ?? "";
    const body = part.body?.data;
    if (body) {
      const decoded = decodeBase64Url(body);
      if (mime.startsWith("text/plain")) textParts.push(decoded);
      else if (mime.startsWith("text/html")) htmlParts.push(decoded);
    }
    for (const child of part.parts ?? []) walk(child);
  };
  walk(payload);

  if (textParts.length > 0) return textParts.join("\n");
  if (htmlParts.length > 0) {
    // Crude HTML → text fallback
    return htmlParts
      .join("\n")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }
  return "";
}

function getHeader(message: gmail_v1.Schema$Message, name: string): string {
  const header = message.payload?.headers?.find(
    (h) => h.name?.toLowerCase() === name.toLowerCase()
  );
  return header?.value ?? "";
}

/**
 * Default to gemini-2.5-flash-lite: still on the free tier in most regions,
 * lower latency than 2.0-flash, and cheap when billing is enabled. Override
 * with GEMINI_MODEL in server/.env if Google phases it off the free tier too.
 */
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${env.GEMINI_MODEL}:generateContent`;

const EXTRACTION_PROMPT = `You are extracting grocery and food items from a receipt or order-confirmation email.

Rules:
- ONLY include perishable food items that would go in a fridge, freezer, or pantry. Include produce, dairy, meat, bread, prepared meals, frozen foods, beverages, condiments, snacks, and grains.
- EXCLUDE non-food items (paper goods, cleaning supplies, toiletries, pet food, alcohol unrefrigerated liquor, gift cards, tips, taxes, fees, delivery charges, service fees).
- EXCLUDE already-consumed restaurant/takeout meals (e.g., a DoorDash burrito someone already ate). Only include grocery-style items that will be stored.
- If the email is NOT a grocery/food receipt (e.g. it's a promo, shipping notice with no items, newsletter), return {"items": []}.
- Normalize names to singular lowercase English (e.g. "Organic Bananas 2lb" -> "bananas").
- Categorize each item as exactly one of: dairy, meat, bread, produce, beverages, grains, snacks, condiments, frozen, other.
- quantity is a short human string like "1 unit", "2 units", "1 lb", "12 oz", "1 dozen".
- freshDays is YOUR best estimate of how many days this specific food stays good UNOPENED from today at typical fridge/pantry storage. Use your knowledge of that specific food, not the category. Examples: bananas 5, apples 28, strawberries 5, whole milk 7, greek yogurt 14, ground beef 2, chicken breast 2, sliced bread 7, eggs 28, hard cheese 30, canned beans 365, rice 365, frozen berries 180. If you are NOT confident in the specific food, OMIT freshDays for that item and we will fall back to the category default. Integer days only, max 730.

Return ONLY a JSON object matching this TypeScript type:
{ "items": Array<{ "name": string, "category": "dairy"|"meat"|"bread"|"produce"|"beverages"|"grains"|"snacks"|"condiments"|"frozen"|"other", "quantity": string, "freshDays"?: number }> }

Email subject: {{SUBJECT}}
Email from: {{FROM}}

Email body (truncated):
{{BODY}}`;

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
}

const VALID_CATEGORIES = new Set([
  "dairy",
  "meat",
  "bread",
  "produce",
  "beverages",
  "grains",
  "snacks",
  "condiments",
  "frozen",
  "other"
]);

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Parse Google's `retryDelay` hint from a 429 error body, e.g. "27s".
 * Falls back to `fallbackMs` if the hint is missing or unparseable.
 */
function parseRetryDelayMs(errorBody: string, fallbackMs: number): number {
  const match = errorBody.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  if (!match) return fallbackMs;
  const secs = Number(match[1]);
  return Number.isFinite(secs) ? Math.min(60_000, Math.ceil(secs * 1000)) : fallbackMs;
}

async function extractItemsWithGemini(
  apiKey: string,
  subject: string,
  from: string,
  body: string
): Promise<ScannedGmailItem[]> {
  const truncatedBody = body.slice(0, 12_000);
  const prompt = EXTRACTION_PROMPT.replace("{{SUBJECT}}", subject)
    .replace("{{FROM}}", from)
    .replace("{{BODY}}", truncatedBody);

  const requestBody = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          items: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                category: { type: "STRING" },
                quantity: { type: "STRING" },
                freshDays: { type: "INTEGER" }
              },
              required: ["name", "category", "quantity"]
            }
          }
        },
        required: ["items"]
      }
    }
  });

  // Retry once on 429 using the retryDelay hint Google returns. If we're still
  // rate-limited after that, bubble the error up so the scan loop can salvage
  // whatever was already extracted.
  let res: Response;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: requestBody
    });
    if (res.status !== 429 || attempt >= 1) break;
    const retryBody = await res.clone().text().catch(() => "");
    const waitMs = parseRetryDelayMs(retryBody, 5_000);
    console.warn(`[gmail] Gemini 429, waiting ${waitMs}ms before single retry…`);
    await sleep(waitMs);
    attempt += 1;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.warn(`[gmail] Gemini extract failed ${res.status}: ${text.slice(0, 2000)}`);
    if (res.status === 429) {
      throw new GmailScanError(
        429,
        "GEMINI_QUOTA_EXCEEDED",
        "Gemini API quota exceeded. Check your plan & billing at https://ai.dev/rate-limit, or wait for the quota to reset."
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new GmailScanError(
        res.status,
        "GEMINI_UNAUTHORIZED",
        "Gemini rejected the API key. Verify GEMINI_API_KEY in server/.env."
      );
    }
    throw new GmailScanError(
      res.status,
      "GEMINI_FAILED",
      `Gemini request failed with status ${res.status}.`
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text.trim()) return [];

  let parsed: {
    items?: Array<{
      name?: string;
      category?: string;
      quantity?: string;
      freshDays?: number | string;
    }>;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.warn(`[gmail] Gemini returned non-JSON: ${text.slice(0, 300)}`);
    return [];
  }

  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return items
    .map((raw): ScannedGmailItem => {
      const name = (raw.name ?? "").trim().toLowerCase();
      const category = (raw.category ?? "other").trim().toLowerCase();
      const quantity = (raw.quantity ?? "1 unit").trim() || "1 unit";
      // Clamp Gemini's estimate to a sane range. 0/negative and absurdly
      // large values usually mean the model was guessing, so drop them and
      // let the category rule take over.
      const rawFresh = typeof raw.freshDays === "string" ? Number(raw.freshDays) : raw.freshDays;
      const freshDays =
        typeof rawFresh === "number" && Number.isFinite(rawFresh) && rawFresh >= 1 && rawFresh <= 730
          ? Math.round(rawFresh)
          : undefined;
      return {
        name,
        category: VALID_CATEGORIES.has(category) ? category : "other",
        quantity,
        ...(freshDays !== undefined ? { freshDays } : {})
      };
    })
    .filter((item) => item.name.length >= 2 && item.name.length <= 120);
}

/** Deduplicates scanned items by case-insensitive name, keeping the first occurrence. */
function dedupeItems(items: ScannedGmailItem[]): ScannedGmailItem[] {
  const seen = new Set<string>();
  const out: ScannedGmailItem[] = [];
  for (const item of items) {
    const key = item.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export interface ScanOptions {
  /** Only fetch emails newer than this date (from last successful sync). */
  lastSyncAt?: Date | null;
  /**
   * Max messages to process per scan. Default 8 to stay well under the
   * Gemini free-tier 15 RPM limit while still covering a busy inbox over
   * multiple scans.
   */
  maxMessages?: number;
}

/**
 * Minimum delay between Gemini calls, chosen so that a full scan of
 * `maxMessages` can finish under the free-tier 15 RPM quota without
 * tripping 429s. 4s between calls = 15 calls/min.
 */
const GEMINI_CALL_SPACING_MS = 4_000;

/**
 * Fetches recent receipt emails from Gmail and extracts fridge/pantry items
 * via Gemini Flash. Returns a deduplicated list of items ready to insert.
 */
export async function scanGmailForReceipts(
  oAuth2Client: OAuth2Client,
  geminiApiKey: string,
  options: ScanOptions = {}
): Promise<ScannedGmailItem[]> {
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  const query = buildGmailQuery(options.lastSyncAt ?? null);
  const maxMessages = options.maxMessages ?? 8;

  const list = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: maxMessages
  });

  const messageRefs = list.data.messages ?? [];
  if (messageRefs.length === 0) return [];

  // Rewind the effective cutoff by 10 minutes so emails that arrived just
  // before the last scan — but weren't yet in Gmail's search index at the
  // time — still get a second chance on the next scan. Duplicate items are
  // filtered upstream via the existingNames check, so the overlap is safe.
  const SYNC_SAFETY_WINDOW_MS = 10 * 60 * 1000;
  const lastSyncMs = options.lastSyncAt
    ? options.lastSyncAt.getTime() - SYNC_SAFETY_WINDOW_MS
    : 0;
  const allItems: ScannedGmailItem[] = [];

  let geminiCallIndex = 0;
  for (const ref of messageRefs) {
    if (!ref.id) continue;
    try {
      const { data: message } = await gmail.users.messages.get({
        userId: "me",
        id: ref.id,
        format: "full"
      });

      // Gmail's `after:` filter is day-granular, so we re-check precisely
      // here using internalDate (ms since epoch) to avoid reprocessing
      // messages that arrived before our last successful scan.
      const internalDateMs = Number(message.internalDate ?? 0);
      if (lastSyncMs > 0 && internalDateMs > 0 && internalDateMs <= lastSyncMs) {
        continue;
      }

      const subject = getHeader(message, "Subject");
      const from = getHeader(message, "From");
      const body = extractBody(message.payload);
      if (!body.trim()) continue;

      // Stay under Gemini's 15 RPM free-tier ceiling by spacing calls out.
      if (geminiCallIndex > 0) await sleep(GEMINI_CALL_SPACING_MS);
      geminiCallIndex += 1;

      const extracted = await extractItemsWithGemini(geminiApiKey, subject, from, body);
      allItems.push(...extracted);
    } catch (err) {
      // On a hard quota failure, salvage whatever we extracted so far rather
      // than throwing away the whole batch. Everything else (network blips,
      // per-message bugs) gets logged and the loop continues.
      if (err instanceof GmailScanError && err.code === "GEMINI_QUOTA_EXCEEDED") {
        if (allItems.length > 0) {
          console.warn(
            `[gmail] Quota hit after ${allItems.length} items extracted; returning partial batch.`
          );
          return dedupeItems(allItems);
        }
        throw err;
      }
      console.warn(`[gmail] Failed to process message ${ref.id}:`, (err as Error).message);
    }
  }

  return dedupeItems(allItems);
}
