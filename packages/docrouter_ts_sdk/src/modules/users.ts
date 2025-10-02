import { HttpClient } from '../http-client';
import {
  UserCreate,
  UserUpdate,
  UserResponse,
  ListUsersParams,
  ListUsersResponse,
} from '../types';

export class UsersAPI {
  constructor(private http: HttpClient) {}

  async list(params?: ListUsersParams): Promise<ListUsersResponse> {
    const queryParams = new URLSearchParams();
    if (params?.skip) queryParams.append('skip', params.skip.toString());
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.organization_id) queryParams.append('organization_id', params.organization_id);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.search_name) queryParams.append('search_name', params.search_name);

    return this.http.get<ListUsersResponse>(
      `/v0/account/users?${queryParams.toString()}`
    );
  }

  async get(userId: string): Promise<UserResponse> {
    const response = await this.list({ user_id: userId });
    return { user: response.users[0] }; // Will always return exactly one user
  }

  async create(user: UserCreate): Promise<UserResponse> {
    const createdUser = await this.http.post('/v0/account/users', user);
    return { user: createdUser };
  }

  async update(userId: string, update: UserUpdate): Promise<UserResponse> {
    const updatedUser = await this.http.put(`/v0/account/users/${userId}`, update);
    return { user: updatedUser };
  }

  async delete(userId: string): Promise<void> {
    await this.http.delete(`/v0/account/users/${userId}`);
  }

  async sendVerificationEmail(userId: string) {
    return this.http.post(`/v0/account/email/verification/send/${userId}`);
  }

  async verifyEmail(token: string) {
    return this.http.post(`/v0/account/email/verification/${token}`);
  }

  async sendRegistrationVerificationEmail(userId: string) {
    return this.http.post(`/v0/account/email/verification/register/${userId}`);
  }
}
