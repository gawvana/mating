import { AIParseResponse, MonthlyStats, ShoppingItem, User } from "../types";
import { getTelegramInitData, isTelegramWebApp } from "../telegram/telegram";
import { parseShoppingTextDeterministically, calculateTotals } from "../utils/localParser";

export class ApiError extends Error {
  code: string;
  statusCode: number;

  constructor(message: string, code: string = "UNKNOWN_ERROR", statusCode: number = 500) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class ConflictError extends ApiError {
  constructor(message: string = "Item was updated by another request. Please refresh.") {
    super(message, "VERSION_CONFLICT", 409);
    this.name = "ConflictError";
  }
}

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── LOCAL STORAGE GUEST STORE (For standalone web browsing outside Telegram) ──
const GUEST_ITEMS_KEY = "mating_guest_items";
const GUEST_DELETED_ITEMS_KEY = "mating_guest_deleted_items";

function getGuestItems(): ShoppingItem[] {
  try {
    const stored = localStorage.getItem(GUEST_ITEMS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveGuestItems(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(GUEST_ITEMS_KEY, JSON.stringify(items));
  } catch {}
}

function getGuestDeletedItems(): ShoppingItem[] {
  try {
    const stored = localStorage.getItem(GUEST_DELETED_ITEMS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveGuestDeletedItems(items: ShoppingItem[]): void {
  try {
    localStorage.setItem(GUEST_DELETED_ITEMS_KEY, JSON.stringify(items));
  } catch {}
}

class ApiClient {
  private baseUrl: string = "";

  private getAuthHeader(): string {
    const token = getTelegramInitData();
    if (!token) return "";
    if (token.startsWith("tma-test ") || token.startsWith("tma ")) {
      return token;
    }
    return `tma ${token}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");

    const auth = this.getAuthHeader();
    if (auth) {
      headers.set("Authorization", auth);
    }

    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        let errorData: any = {};
        try {
          errorData = await response.json();
        } catch {
          // Non-JSON response
        }

        const errorCode = errorData?.error?.code || `HTTP_${response.status}`;
        const errorMsg = errorData?.error?.message || response.statusText || "Request failed";

        if (response.status === 409) {
          throw new ConflictError(errorMsg);
        }

        throw new ApiError(errorMsg, errorCode, response.status);
      }

      return (await response.json()) as T;
    } catch (err: any) {
      if (err instanceof ApiError) {
        throw err;
      }
      if (err.name === "AbortError") {
        throw new ApiError("Request was aborted", "ABORTED", 0);
      }
      throw new ApiError(err.message || "Network error. Please check your connection.", "NETWORK_ERROR", 0);
    }
  }

  // ── Profile & Settings ──
  async getProfile(): Promise<User> {
    if (!isTelegramWebApp()) {
      return {
        id: "guest-user",
        telegram_id: 0,
        username: "",
        first_name: "Пользователь",
        language_code: "ru",
        currency_code: "UZS",
        city: null,
        monthly_budget: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return this.request<User>("/api/v1/profile");
  }

  async updateSettings(data: {
    language_code?: string;
    currency_code?: string;
    city?: string | null;
    monthly_budget?: number | null;
  }): Promise<User> {
    if (!isTelegramWebApp()) {
      const current = await this.getProfile();
      return { ...current, ...data };
    }
    return this.request<User>("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // ── Shopping Items ──
  async getItems(): Promise<ShoppingItem[]> {
    if (!isTelegramWebApp()) {
      return getGuestItems();
    }
    return this.request<ShoppingItem[]>("/api/v1/items");
  }

  async createItem(data: {
    name: string;
    quantity?: number;
    unit?: string;
    category?: string;
    price?: number | null;
    currency_code?: string;
    raw_input_text?: string | null;
    client_mutation_id?: string;
  }): Promise<ShoppingItem> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const newItem: ShoppingItem = {
        id: generateUUID(),
        user_id: "guest",
        name: data.name,
        quantity: data.quantity ?? 1,
        unit: data.unit ?? "шт",
        category: data.category ?? "Другое",
        price: data.price ?? null,
        currency_code: data.currency_code ?? "UZS",
        is_purchased: false,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      items.unshift(newItem);
      saveGuestItems(items);
      return newItem;
    }

    const payload = {
      ...data,
      client_mutation_id: data.client_mutation_id || generateUUID(),
    };
    return this.request<ShoppingItem>("/api/v1/items", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  async batchCreateItems(
    items: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      category?: string;
      price?: number | null;
      currency_code?: string;
      raw_input_text?: string | null;
    }>
  ): Promise<ShoppingItem[]> {
    if (!isTelegramWebApp()) {
      const existing = getGuestItems();
      const created: ShoppingItem[] = items.map((it) => ({
        id: generateUUID(),
        user_id: "guest",
        name: it.name,
        quantity: it.quantity ?? 1,
        unit: it.unit ?? "шт",
        category: it.category ?? "Другое",
        price: it.price ?? null,
        currency_code: it.currency_code ?? "UZS",
        is_purchased: false,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      const updated = [...created, ...existing];
      saveGuestItems(updated);
      return created;
    }

    const prepared = items.map((it) => ({
      ...it,
      client_mutation_id: generateUUID(),
    }));
    return this.request<ShoppingItem[]>("/api/v1/items/batch", {
      method: "POST",
      body: JSON.stringify({ items: prepared }),
    });
  }

  async updateItem(
    id: string,
    version: number,
    data: {
      name?: string;
      quantity?: number;
      unit?: string;
      category?: string;
      price?: number | null;
      currency_code?: string;
      is_purchased?: boolean;
    }
  ): Promise<ShoppingItem> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const idx = items.findIndex((it) => it.id === id);
      if (idx !== -1) {
        items[idx] = { ...items[idx], ...data, version: version + 1, updated_at: new Date().toISOString() };
        saveGuestItems(items);
        return items[idx];
      }
      throw new ApiError("Item not found", "NOT_FOUND", 404);
    }

    return this.request<ShoppingItem>(`/api/v1/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...data, version }),
    });
  }

  async togglePurchased(id: string, version: number): Promise<ShoppingItem> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const idx = items.findIndex((it) => it.id === id);
      if (idx !== -1) {
        const nextPurchased = !items[idx].is_purchased;
        items[idx] = {
          ...items[idx],
          is_purchased: nextPurchased,
          purchased_at: nextPurchased ? new Date().toISOString() : null,
          version: version + 1,
          updated_at: new Date().toISOString(),
        };
        saveGuestItems(items);
        return items[idx];
      }
      throw new ApiError("Item not found", "NOT_FOUND", 404);
    }

    return this.request<ShoppingItem>(`/api/v1/items/${id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ version }),
    });
  }

  async deleteItem(id: string): Promise<ShoppingItem> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const idx = items.findIndex((it) => it.id === id);
      if (idx !== -1) {
        const [deleted] = items.splice(idx, 1);
        saveGuestItems(items);

        // Soft-delete symmetrically: stamp deleted_at, increment version
        const now = new Date().toISOString();
        const softDeletedItem: ShoppingItem = {
          ...deleted,
          deleted_at: now,
          version: (deleted.version || 1) + 1,
          updated_at: now,
        };

        const deletedItems = getGuestDeletedItems().filter((it) => it.id !== id);
        deletedItems.unshift(softDeletedItem);
        saveGuestDeletedItems(deletedItems);

        return softDeletedItem;
      }
      throw new ApiError("Item not found", "NOT_FOUND", 404);
    }

    return this.request<ShoppingItem>(`/api/v1/items/${id}`, {
      method: "DELETE",
    });
  }

  async restoreItem(id: string): Promise<ShoppingItem> {
    if (!isTelegramWebApp()) {
      const deletedItems = getGuestDeletedItems();
      const idx = deletedItems.findIndex((it) => it.id === id);
      if (idx !== -1) {
        const [toRestore] = deletedItems.splice(idx, 1);
        saveGuestDeletedItems(deletedItems);

        // Restore: clear deleted_at, increment version, update timestamp
        const now = new Date().toISOString();
        const restoredItem: ShoppingItem = {
          ...toRestore,
          deleted_at: null,
          version: (toRestore.version || 1) + 1,
          updated_at: now,
        };

        const activeItems = getGuestItems();
        activeItems.unshift(restoredItem);
        saveGuestItems(activeItems);

        return restoredItem;
      }
      throw new ApiError("Item not found in deleted items", "NOT_FOUND", 404);
    }

    return this.request<ShoppingItem>(`/api/v1/items/${id}/restore`, {
      method: "POST",
    });
  }

  async clearPurchased(): Promise<{ cleared_count: number }> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const active = items.filter((it) => !it.is_purchased);
      const purchased = items.filter((it) => it.is_purchased);
      const clearedCount = purchased.length;

      if (clearedCount > 0) {
        const now = new Date().toISOString();
        const softDeletedPurchased: ShoppingItem[] = purchased.map((it) => ({
          ...it,
          deleted_at: now,
          version: (it.version || 1) + 1,
          updated_at: now,
        }));
        const existingDeleted = getGuestDeletedItems();
        saveGuestDeletedItems([...softDeletedPurchased, ...existingDeleted]);
      }

      saveGuestItems(active);
      return { cleared_count: clearedCount };
    }

    return this.request<{ cleared_count: number }>("/api/v1/items/clear-purchased", {
      method: "POST",
    });
  }

  // ── AI Parsing (Dual-Tier: Local Fast Parser + Gemini) ──
  async parseAI(text: string, signal?: AbortSignal): Promise<AIParseResponse> {
    // 1. Fast deterministic parse first (0 ms response time!)
    const local = parseShoppingTextDeterministically(text);
    if (local && local.length > 0) {
      return { items: local, raw_text: text };
    }

    // 2. Complex natural language -> backend Gemini API
    if (isTelegramWebApp()) {
      return this.request<AIParseResponse>("/api/v1/ai/parse", {
        method: "POST",
        body: JSON.stringify({ text }),
        signal,
      });
    }

    // Outside Telegram, return whatever local parser detected or empty
    return { items: local || [], raw_text: text };
  }

  // ── Monthly Stats ──
  async getMonthlyStats(year?: number, month?: number): Promise<MonthlyStats> {
    if (!isTelegramWebApp()) {
      const items = getGuestItems();
      const purchased = items.filter((it) => it.is_purchased);
      const totals = calculateTotals(purchased);

      const byCat: Record<string, { total: number; count: number }> = {};
      for (const it of purchased) {
        const cat = it.category || "Другое";
        if (!byCat[cat]) byCat[cat] = { total: 0, count: 0 };
        byCat[cat].count++;
        if (it.price) byCat[cat].total += it.price * it.quantity;
      }

      const categories = Object.entries(byCat).map(([cat, val]) => ({
        category: cat,
        amount: val.total,
        count: val.count,
        percentage: totals.grandTotal > 0 ? Math.round((val.total / totals.grandTotal) * 100) : 0,
      }));

      return {
        year: year || new Date().getFullYear(),
        month: month || new Date().getMonth() + 1,
        total_spent: totals.grandTotal,
        currency_code: "UZS",
        monthly_budget: null,
        budget_remaining: null,
        budget_usage_percent: null,
        items_purchased_count: purchased.length,
        active_items_count: items.length - purchased.length,
        categories,
      };
    }

    const query = new URLSearchParams();
    if (year) query.set("year", year.toString());
    if (month) query.set("month", month.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<MonthlyStats>(`/api/v1/stats/monthly${qs}`);
  }
}

export const api = new ApiClient();
