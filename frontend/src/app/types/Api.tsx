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
  password: string;
  role?: string;
}

export interface UserUpdate {
  name?: string;
  role?: string;
  emailVerified?: boolean;
  password?: string;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean | null;
  createdAt: string;
  hasPassword: boolean;
}

export interface ListUsersParams {
  skip?: number;
  limit?: number;
  organization_id?: string;
  user_id?: string;
}

export interface ListUsersResponse {
  users: UserResponse[];
  total_count: number;
  skip: number;
}

export interface SchemaField {
  name: string;
  type: 'str' | 'int' | 'float' | 'bool' | 'datetime';
}

export interface SchemaCreate {
  name: string;
  fields: SchemaField[];
}

export interface Schema extends SchemaCreate {
  id: string;
  version: number;
  created_at: string;
  created_by: string;
}

export interface ListSchemasParams {
  skip?: number;
  limit?: number;
}

export interface ListSchemasResponse {
  schemas: Schema[];
  total_count: number;
  skip: number;
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

export interface ListInvitationsParams {
  skip?: number;
  limit?: number;
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