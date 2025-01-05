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

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  organization_id?: string;
  user_id?: string;
}

export type InvitationStatus = 'pending' | 'accepted' | 'expired';

export interface CreateInvitationRequest {
  email: string;
  organization_id?: string;
}

export interface InvitationResponse {
  id: string;
  email: string;
  status: InvitationStatus;
  expires: string;
  created_by: string;
  created_at: string;
  organization_id?: string;
}

export interface ListInvitationsResponse {
  invitations: InvitationResponse[];
  total_count: number;
  skip: number;
}

export interface AcceptInvitationRequest {
  name: string;
  password: string;
}