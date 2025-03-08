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
  hasSeenTour?: boolean;
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  role: string;
  emailVerified: boolean | null;
  createdAt: string;
  hasPassword: boolean;
  hasSeenTour: boolean;
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
