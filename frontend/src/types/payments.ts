export interface PortalSessionCreate {
  org_id: string;
}

export interface PortalSessionResponse {
  url: string;
}

// Add these new types
export interface SubscriptionPlan {
  plan_id: string;
  name: string;
  price_id: string;
  price: number;
  currency: string;
  interval: string;
  features: string[];
  included_usage: number;
  overage_price: number;
}

export interface SubscriptionPlanResponse {
  plans: SubscriptionPlan[];
  current_plan: string | null;
}

export interface SubscriptionHistory {
  user_id: string;
  stripe_customer_id: string;
  subscription_id: string;
  subscription_item_id: string;
  price_id: string;
  subscription_type: string;
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