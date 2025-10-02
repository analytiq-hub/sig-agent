import { HttpClient } from '../http-client';
import {
  CreateTokenRequest,
  AccessToken,
} from '../types';

export class TokensAPI {
  constructor(private http: HttpClient) {}

  // Account-level token management
  async createAccountToken(token: CreateTokenRequest) {
    return this.http.post('/v0/account/access_tokens', token);
  }

  async getAccountTokens() {
    return this.http.get('/v0/account/access_tokens');
  }

  async deleteAccountToken(tokenId: string) {
    return this.http.delete(`/v0/account/access_tokens/${tokenId}`);
  }

  // Organization-level token management
  async createOrganizationToken(token: CreateTokenRequest, organizationId: string) {
    return this.http.post(`/v0/orgs/${organizationId}/access_tokens`, token);
  }

  async getOrganizationTokens(organizationId: string) {
    return this.http.get(`/v0/orgs/${organizationId}/access_tokens`);
  }

  async deleteOrganizationToken(tokenId: string, organizationId: string) {
    return this.http.delete(`/v0/orgs/${organizationId}/access_tokens/${tokenId}`);
  }
}
