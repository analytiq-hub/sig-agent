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
  organization_name: string;
  user_exists: boolean;
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