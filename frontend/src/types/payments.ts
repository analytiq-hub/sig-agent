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
  price_per_page: number;
  features: string[];
}

export interface SubscriptionPlanResponse {
  plans: SubscriptionPlan[];
  current_plan: string | null;
}