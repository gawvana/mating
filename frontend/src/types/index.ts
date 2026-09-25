export interface User {
  id: string;
  username: string | null;
  first_name: string | null;
  language_code: string;
  currency_code: string;
  city: string | null;
  monthly_budget: number | null;
  created_at: string;
  updated_at: string;
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
  raw_input_text: string | null;
  created_at: string;
  purchased_at: string | null;
  version: number;
  client_mutation_id: string | null;
  deleted_at: string | null;
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
