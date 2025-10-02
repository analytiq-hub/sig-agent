import { HttpClient } from '../http-client';
import {
  ListOrganizationsResponse,
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  OrganizationMember,
  OrganizationType,
} from '../types';

export class OrganizationsAPI {
  constructor(private http: HttpClient) {}

  async list(params?: { 
    userId?: string;
    organizationId?: string;
    nameSearch?: string;
    memberSearch?: string;
    skip?: number;
    limit?: number;
  }): Promise<ListOrganizationsResponse> {
    const queryParams = new URLSearchParams();
    if (params?.userId) queryParams.append('user_id', params.userId);
    if (params?.organizationId) queryParams.append('organization_id', params.organizationId);
    if (params?.nameSearch) queryParams.append('name_search', params.nameSearch);
    if (params?.memberSearch) queryParams.append('member_search', params.memberSearch);
    if (params?.skip !== undefined) queryParams.append('skip', String(params.skip));
    if (params?.limit !== undefined) queryParams.append('limit', String(params.limit));
    
    return this.http.get<ListOrganizationsResponse>(
      `/v0/account/organizations?${queryParams.toString()}`
    );
  }

  async get(organizationId: string): Promise<Organization> {
    const response = await this.list({ organizationId });
    return response.organizations[0]; // Will always return exactly one organization
  }

  async create(organization: CreateOrganizationRequest): Promise<Organization> {
    const response = await this.http.post<{
      _id?: string;
      id: string;
      name: string;
      members: OrganizationMember[];
      type: OrganizationType;
      created_at: string;
      updated_at: string;
    }>('/v0/account/organizations', organization);
    
    return {
      id: response._id || response.id,
      name: response.name,
      members: response.members,
      type: response.type,
      created_at: response.created_at,
      updated_at: response.updated_at
    };
  }

  async update(organizationId: string, update: UpdateOrganizationRequest): Promise<Organization> {
    return this.http.put(`/v0/account/organizations/${organizationId}`, update);
  }

  async delete(organizationId: string) {
    return this.http.delete(`/v0/account/organizations/${organizationId}`);
  }
}
