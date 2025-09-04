export interface PortalSessionResponse {
  url: string;
}

// Add these new types
export interface SubscriptionPlan {
  plan_id: string;
  name: string;
  base_price: number;
  included_spus: number;
  features: string[];
  currency: string;
  interval: string;
}

export interface SubscriptionResponse {
  plans: SubscriptionPlan[];
  current_plan: string | null;
  subscription_status: string | null;
  cancel_at_period_end: boolean;
  current_period_end: number | null;  // Unix timestamp
}

export interface SubscriptionHistory {
  user_id: string;
  stripe_customer_id: string;
  subscription_id: string;
  subscription_item_id: string;
  price_id: string;
  subscription_type: string | null;
  status: string;
  start_date: string;  // ISO date string
  end_date: string | null;  // ISO date string
  usage_during_period: number;
  created_at: string;  // ISO date string
  updated_at: string;  // ISO date string
}

export interface SubscriptionHistoryResponse {
  subscription_history: SubscriptionHistory[];
}

// Update UsageData interface to match the backend structure exactly
export interface UsageData {
  metered_usage: number;
  remaining_included: number;
  subscription_type: string | null;
  usage_unit?: string;
  purchased_credits: number;
  purchased_credits_used: number;
  purchased_credits_remaining: number;
  admin_credits: number;
  admin_credits_used: number;
  admin_credits_remaining: number;
  period_start: number | null;
  period_end: number | null;
}

export interface UsageResponse {
  usage_source: 'stripe' | 'local' | 'none';
  data: UsageData | null;
}

export interface CreditConfig {
  price_per_credit: number;
  currency: string;
  min_cost: number;  // Changed from min_credits
  max_cost: number;  // Changed from max_credits
}

export interface CreditUpdateResponse {
  success: boolean;
  added: number;
}