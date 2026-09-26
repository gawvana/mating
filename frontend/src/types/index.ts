export interface User {
  id: string;
  telegram_id?: number;
  username: string | null;
  first_name: string | null;
  language_code: string;
  currency_code: string;
  city: string | null;
  monthly_budget: number | null;
  created_at: string;
  updated_at?: string;
}

export interface ShoppingItem {
  id: string;
  user_id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price: number | null;
  currency_code: string;
  is_purchased: boolean;
  raw_input_text?: string | null;
  created_at: string;
  purchased_at?: string | null;
  version: number;
  client_mutation_id?: string | null;
  deleted_at?: string | null;
  updated_at?: string;
}

export interface CategorySpending {
  category: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface MonthlyStats {
  year: number;
  month: number;
  currency_code: string;
  total_spent: number;
  monthly_budget: number | null;
  budget_remaining: number | null;
  budget_usage_percent: number | null;
  items_purchased_count: number;
  active_items_count: number;
  categories: CategorySpending[];
}

export interface AIParsedItem {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  estimated_price: number | null;
  confidence: number;
}

export interface AIParseResponse {
  items: AIParsedItem[];
  raw_text: string;
}

export interface HistoryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price: number | null;
  currency_code: string;
  purchased_at: string | null;
}

export interface HistoryGroup {
  date: string;
  label: string;
  total_spent: number;
  item_count: number;
  currency_code: string;
  items: HistoryItem[];
}

export interface FrequentItem {
  name: string;
  category: string;
  count: number;
  every_days: number;
}

export interface HistoryResponse {
  groups: HistoryGroup[];
  frequent_items: FrequentItem[];
}

export interface SharedItemPayload {
  name: string;
  quantity: number;
  unit: string;
  category: string;
  price: number | null;
  currency_code?: string;
  is_purchased?: boolean;
}

export interface CreateShareResponse {
  token: string;
  share_url: string;
  item_count: number;
  created_at: string;
}

export interface PublicSnapshotResponse {
  token: string;
  title: string;
  item_count: number;
  created_at: string;
  items: SharedItemPayload[];
}

