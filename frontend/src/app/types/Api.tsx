export interface OrganizationMember {
  user_id: string;
  role: 'admin' | 'user';
}

export type OrganizationType = 'personal' | 'team' | 'enterprise';

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  members: OrganizationMember[];
  created_at: string;
  updated_at: string;
}

export interface CreateOrganizationRequest {
  name: string;
  type?: OrganizationType;
}

export interface UpdateOrganizationRequest {
  name?: string;
  type?: OrganizationType;
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