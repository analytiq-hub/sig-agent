import { HttpClient } from '../http-client';
import {
  CreateTokenRequest,
  AccessToken,
  ListAccessTokensResponse,
} from '../types';

export class TokensAPI {
  constructor(private http: HttpClient) {}

  // Account-level token management
  async createAccountToken(token: CreateTokenRequest): Promise<AccessToken> {
    return this.http.post('/v0/account/access_tokens', token);
  }

  async getAccountTokens(): Promise<AccessToken[]> {
    const response = await this.http.get<ListAccessTokensResponse>('/v0/account/access_tokens');
    return response.access_tokens;
  }

  async deleteAccountToken(tokenId: string): Promise<void> {
    return this.http.delete(`/v0/account/access_tokens/${tokenId}`);
  }

  // Organization-level token management
  async createOrganizationToken(token: CreateTokenRequest, organizationId: string): Promise<AccessToken> {
    return this.http.post(`/v0/orgs/${organizationId}/access_tokens`, token);
  }

  async getOrganizationTokens(organizationId: string): Promise<AccessToken[]> {
    const response = await this.http.get<ListAccessTokensResponse>(`/v0/orgs/${organizationId}/access_tokens`);
    return response.access_tokens;
  }

  async deleteOrganizationToken(tokenId: string, organizationId: string): Promise<void> {
    return this.http.delete(`/v0/orgs/${organizationId}/access_tokens/${tokenId}`);
  }
}
