import { Session } from 'next-auth';

export interface AppSession extends Session {
  providerAccessToken?: string;
  apiAccessToken?: string;
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    isAdmin: boolean;
    role?: string;
  };
} 