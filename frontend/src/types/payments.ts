export interface PortalSessionCreate {
  user_id: string;
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