import { Session } from "next-auth";

export interface AppSession extends Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
    };
    providerAccessToken: string;
    apiAccessToken: string;
    expires: string;
}