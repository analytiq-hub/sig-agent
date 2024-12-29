export interface OrganizationMember {
  user_id: string;
  role: 'admin' | 'user';
}

export interface Organization {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  members: OrganizationMember[];
}

export interface CreateOrganizationRequest {
  name: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  members?: OrganizationMember[];
}

export interface ListOrganizationsResponse {
  organizations: Organization[];
}

export interface UserCreate {
  email: string;
  name: string;
  password?: string;
  role?: string;
  provider?: 'google' | 'github';
}