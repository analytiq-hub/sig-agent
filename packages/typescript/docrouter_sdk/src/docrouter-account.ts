import { HttpClient } from './http-client';
import {
  DocRouterAccountConfig,
  AccessToken,
  ListOrganizationsResponse,
  Organization,
  CreateOrganizationRequest,
  UpdateOrganizationRequest,
  CreateTokenRequest,
  ListAccessTokensResponse,
  ListLLMModelsParams,
  ListLLMModelsResponse,
  ListLLMProvidersResponse,
  SetLLMProviderConfigRequest,
  ListUsersParams,
  ListUsersResponse,
  UserCreate,
  UserResponse,
  UserUpdate,
  User,
  AWSConfig,
} from './types';

/**
 * DocRouterAccount - For account-level operations with account tokens
 * Use this for server-to-server integrations that need full account access
 */
export class DocRouterAccount {
  private http: HttpClient;

  constructor(config: DocRouterAccountConfig) {
    this.http = new HttpClient({
      baseURL: config.baseURL,
      token: config.accountToken,
      timeout: config.timeout,
      retries: config.retries,
      onAuthError: config.onAuthError,
    });
  }

  /**
   * Update the account token
   */
  updateToken(token: string): void {
    this.http.updateToken(token);
  }

  // --------------- Organizations ---------------
  async listOrganizations(params?: { 
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
    return this.http.get<ListOrganizationsResponse>(`/v0/account/organizations?${queryParams.toString()}`);
  }

  async getOrganization(organizationId: string): Promise<Organization> {
    const response = await this.listOrganizations({ organizationId });
    return response.organizations[0];
  }

  async createOrganization(organization: CreateOrganizationRequest): Promise<Organization> {
    const response = await this.http.post<{
      _id?: string;
      id: string;
      name: string;
      members: Organization['members'];
      type: Organization['type'];
      created_at: string;
      updated_at: string;
    }>(`/v0/account/organizations`, organization);
    return {
      id: response._id || response.id,
      name: response.name,
      members: response.members,
      type: response.type,
      created_at: response.created_at,
      updated_at: response.updated_at,
    };
  }

  async updateOrganization(organizationId: string, update: UpdateOrganizationRequest): Promise<Organization> {
    return this.http.put(`/v0/account/organizations/${organizationId}`, update);
  }

  async deleteOrganization(organizationId: string) {
    return this.http.delete(`/v0/account/organizations/${organizationId}`);
  }

  // --------------- Tokens ---------------
  async createAccountToken(request: CreateTokenRequest) {
    return this.http.post(`/v0/account/access_tokens`, request);
  }

  async getAccountTokens(): Promise<ListAccessTokensResponse | unknown> {
    const resp = await this.http.get<ListAccessTokensResponse | AccessToken[]>(`/v0/account/access_tokens`);
    // Normalize to array for SDK consumers/tests
    return Array.isArray(resp) ? resp : (resp as ListAccessTokensResponse).access_tokens;
  }

  async deleteAccountToken(tokenId: string) {
    return this.http.delete(`/v0/account/access_tokens/${tokenId}`);
  }

  async createOrganizationToken(request: CreateTokenRequest, organizationId: string) {
    return this.http.post(`/v0/orgs/${organizationId}/access_tokens`, request);
  }

  async getOrganizationTokens(organizationId: string) {
    return this.http.get(`/v0/orgs/${organizationId}/access_tokens`);
  }

  async deleteOrganizationToken(tokenId: string, organizationId: string) {
    return this.http.delete(`/v0/orgs/${organizationId}/access_tokens/${tokenId}`);
  }

  // --------------- LLM (account-level) ---------------
  async listLLMModels(params: ListLLMModelsParams): Promise<ListLLMModelsResponse> {
    return this.http.get<ListLLMModelsResponse>('/v0/account/llm/models', {
      params: {
        provider_name: params.providerName,
        provider_enabled: params.providerEnabled,
        llm_enabled: params.llmEnabled,
      }
    });
  }

  async listLLMProviders(): Promise<ListLLMProvidersResponse> {
    return this.http.get<ListLLMProvidersResponse>('/v0/account/llm/providers');
  }

  async setLLMProviderConfig(providerName: string, request: SetLLMProviderConfigRequest) {
    return this.http.put<SetLLMProviderConfigRequest>(`/v0/account/llm/provider/${providerName}`, request);
  }

  // --------------- Users ---------------
  async listUsers(params?: ListUsersParams): Promise<ListUsersResponse> {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', String(params.skip));
    if (params?.limit) queryParams.append('limit', String(params.limit));
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.search_name) queryParams.append('search_name', params.search_name);
    return this.http.get<ListUsersResponse>(`/v0/account/users?${queryParams.toString()}`);
  }

  async getUser(userId: string): Promise<UserResponse> {
    const response = await this.listUsers({ user_id: userId });
    const user = response.users[0];
    return { user } as UserResponse;
  }

  async createUser(user: UserCreate): Promise<UserResponse> {
    const created = await this.http.post<UserResponse | { user: User }>(
      '/v0/account/users',
      user
    );
    // Normalize to { user }
    return (created as UserResponse).user
      ? (created as UserResponse)
      : ({ user: created as unknown as any }) as UserResponse;
  }

  async updateUser(userId: string, update: UserUpdate): Promise<UserResponse> {
    const updated = await this.http.put<UserResponse | { user: User }>(
      `/v0/account/users/${userId}`,
      update
    );
    return (updated as UserResponse).user
      ? (updated as UserResponse)
      : ({ user: updated as unknown as any }) as UserResponse;
  }

  async deleteUser(userId: string): Promise<void> {
    await this.http.delete(`/v0/account/users/${userId}`);
  }

  // --------------- Email Verification ---------------
  async sendVerificationEmail(userId: string) {
    return this.http.post(`/v0/account/email/verification/send/${userId}`);
  }

  async sendRegistrationVerificationEmail(userId: string) {
    return this.http.post(`/v0/account/email/verification/register/${userId}`);
  }

  async verifyEmail(token: string) {
    return this.http.post(`/v0/account/email/verification/${token}`);
  }

  // --------------- AWS Config ---------------
  async createAWSConfig(config: Omit<AWSConfig, 'created_at'>) {
    return this.http.post('/v0/account/aws_config', config);
  }

  async getAWSConfig() {
    return this.http.get('/v0/account/aws_config');
  }

  async deleteAWSConfig() {
    return this.http.delete('/v0/account/aws_config');
  }

  /**
   * Get the current HTTP client (for advanced usage)
   */
  getHttpClient(): HttpClient {
    return this.http;
  }
}
