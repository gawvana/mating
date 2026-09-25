import { AIParseResponse, MonthlyStats, ShoppingItem, User } from "../types";
import { getTelegramInitData } from "../telegram/telegram";

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

class ApiClient {
  private baseUrl: string = "";

  private getAuthHeader(): string {
    const token = getTelegramInitData();
    if (token.startsWith("tma-test ") || token.startsWith("tma ")) {
      return token;
    }
    return `tma ${token}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("Authorization", this.getAuthHeader());

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

  // Profile & Settings
  async getProfile(): Promise<User> {
    return this.request<User>("/api/v1/profile");
  }

  async updateSettings(data: {
    language_code?: string;
    currency_code?: string;
    city?: string | null;
    monthly_budget?: number | null;
  }): Promise<User> {
    return this.request<User>("/api/v1/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  // Shopping Items
  async getItems(): Promise<ShoppingItem[]> {
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
    return this.request<ShoppingItem>(`/api/v1/items/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...data, version }),
    });
  }

  async togglePurchased(id: string, version: number): Promise<ShoppingItem> {
    return this.request<ShoppingItem>(`/api/v1/items/${id}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ version }),
    });
  }

  async deleteItem(id: string): Promise<ShoppingItem> {
    return this.request<ShoppingItem>(`/api/v1/items/${id}`, {
      method: "DELETE",
    });
  }

  async restoreItem(id: string): Promise<ShoppingItem> {
    return this.request<ShoppingItem>(`/api/v1/items/${id}/restore`, {
      method: "POST",
    });
  }

  async clearPurchased(): Promise<{ cleared_count: number }> {
    return this.request<{ cleared_count: number }>("/api/v1/items/clear-purchased", {
      method: "POST",
    });
  }

  // AI Parsing
  async parseAI(text: string): Promise<AIParseResponse> {
    return this.request<AIParseResponse>("/api/v1/ai/parse", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  // Monthly Stats
  async getMonthlyStats(year?: number, month?: number): Promise<MonthlyStats> {
    const query = new URLSearchParams();
    if (year) query.set("year", year.toString());
    if (month) query.set("month", month.toString());
    const qs = query.toString() ? `?${query.toString()}` : "";
    return this.request<MonthlyStats>(`/api/v1/stats/monthly${qs}`);
  }
}

export const api = new ApiClient();
