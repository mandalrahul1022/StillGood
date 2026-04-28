export interface UserProfile {
  id: string;
  email: string;
  name: string;
  householdName: string | null;
  prefsEmail: boolean;
  prefsInApp: boolean;
}

export interface HouseholdInfo {
  id: string;
  name: string;
  inviteCode: string;
  role: "OWNER" | "MEMBER";
}

export interface Item {
  id: string;
  name: string;
  category: string;
  quantity: string;
  dateAdded: string;
  opened: boolean | null;
  openedAt: string | null;
  customFreshDays: number | null;
  expiresAt: string;
  daysRemaining: number;
  status: "FRESH" | "USE_SOON" | "EXPIRED";
  confidence: number;
  archivedAt: string | null;
  consumedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  type: "USE_SOON" | "EXPIRED";
  message: string;
  readAt: string | null;
  createdAt: string;
  item: {
    id: string;
    name: string;
    category: string;
    status: Item["status"];
  };
}

export interface ScannedItem {
  name: string;
  category: string;
  quantity: string;
}

export interface RecipeSuggestion {
  name: string;
  image: string | null;
  sourceUrl: string | null;
  matchedIngredients: string[];
  shortSteps: string[];
  timeEstimate: string;
}

export interface AnalyticsSummary {
  itemsAddedThisWeek: number;
  itemsConsumedThisWeek: number;
  itemsExpiredThisWeek: number;
  estimatedSavings: number;
  consumedVsExpired: {
    consumed: number;
    expired: number;
  };
  topCategoriesWasted: Array<{
    category: string;
    count: number;
  }>;
}

export interface AnalyticsEvents {
  range: "week" | "month";
  series: Array<{
    date: string;
    consumed: number;
    expired: number;
  }>;
  topCategoriesWasted: Array<{
    category: string;
    count: number;
  }>;
}

interface ApiErrorPayload {
  error?: {
    message?: string;
  };
}

const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

async function apiUpload<T>(path: string, body: FormData): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
    body
  });
  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => ({}))) as { error?: { message?: string } } & T;
  if (!response.ok) throw new Error((data as { error?: { message?: string } }).error?.message ?? "Request failed");
  return data as T;
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => ({}))) as ApiErrorPayload & T;
  if (!response.ok) {
    throw new Error(data.error?.message ?? "Request failed");
  }

  return data as T;
}

export const api = {
  register: (payload: { email: string; password: string; name: string }) =>
    apiRequest<{ user: UserProfile }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  login: (payload: { email: string; password: string }) =>
    apiRequest<{ user: UserProfile }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  logout: () =>
    apiRequest<void>("/auth/logout", {
      method: "POST"
    }),
  me: () => apiRequest<{ user: UserProfile; household: HouseholdInfo | null }>("/auth/me"),
  updateMe: (payload: Partial<Pick<UserProfile, "name" | "householdName" | "prefsEmail" | "prefsInApp">>) =>
    apiRequest<{ user: UserProfile }>("/auth/me", {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  createHousehold: (payload: { name: string }) =>
    apiRequest<{ household: HouseholdInfo }>("/households", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  joinHousehold: (payload: { inviteCode: string }) =>
    apiRequest<{ household: HouseholdInfo }>("/households/join", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getHousehold: () => apiRequest<{ household: HouseholdInfo | null }>("/households/me"),
  regenerateInvite: () =>
    apiRequest<{ inviteCode: string }>("/households/invite", {
      method: "POST",
      body: JSON.stringify({})
    }),
  getMembers: () =>
    apiRequest<{
      members: Array<{ id: string; name: string; email: string; role: "OWNER" | "MEMBER" }>;
    }>("/households/members"),
  listItems: (status: "active" | "archived") =>
    apiRequest<{ items: Item[] }>(`/items?status=${status}`),
  createItem: (payload: {
    name: string;
    category: string;
    quantity: string;
    opened: boolean | null;
    customFreshDays?: number | null;
    dateAdded?: string;
  }) =>
    apiRequest<{ item: Item }>("/items", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  updateItem: (
    id: string,
    payload: Partial<{
      name: string;
      category: string;
      quantity: string;
      opened: boolean | null;
      customFreshDays: number | null;
    }>
  ) =>
    apiRequest<{ item: Item }>(`/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    }),
  deleteItem: (id: string) =>
    apiRequest<void>(`/items/${id}`, {
      method: "DELETE"
    }),
  openItem: (id: string) =>
    apiRequest<{ item: Item }>(`/items/${id}/open`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  consumeItem: (id: string) =>
    apiRequest<{ item: Item }>(`/items/${id}/consume`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  alerts: () => apiRequest<{ alerts: Alert[] }>("/alerts"),
  readAlert: (id: string) =>
    apiRequest<{ alert: Alert }>(`/alerts/${id}/read`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  runAlerts: () =>
    apiRequest<{ result: { scannedItems: number; alertsCreated: number } }>("/alerts/run", {
      method: "POST",
      body: JSON.stringify({})
    }),
  recipeSuggestions: () => apiRequest<{ suggestions: RecipeSuggestion[] }>("/recipes/suggestions"),
  analyticsSummary: () => apiRequest<AnalyticsSummary>("/analytics/summary"),
  analyticsEvents: (range: "week" | "month") =>
    apiRequest<AnalyticsEvents>(`/analytics/history?range=${range}`),
  integrationsStatus: () =>
    apiRequest<{
      gmail: {
        connected: boolean;
        email: string | null;
        lastSyncAt: string | null;
        configured: boolean;
      };
    }>("/integrations/status"),
  gmailConnectUrl: () => {
    const base = API_BASE.startsWith("http") ? API_BASE : window.location.origin + API_BASE;
    return `${base}/integrations/gmail/connect`;
  },
  gmailDisconnect: () =>
    apiRequest<{ ok: true }>("/integrations/gmail/disconnect", {
      method: "POST",
      body: JSON.stringify({})
    }),
  gmailScan: () =>
    apiRequest<{ added: number; skipped: number; items: Item[] }>("/integrations/gmail/scan", {
      method: "POST",
      body: JSON.stringify({})
    }),
  scanReceipt: (file: File) => {
    const form = new FormData();
    form.append("receipt", file);
    return apiUpload<{ items: ScannedItem[]; store: string | null; date: string | null }>("/receipts/scan", form);
  }
};
