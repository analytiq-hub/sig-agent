import { Session } from "next-auth";

export interface AppSession extends Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: "user" | "admin";
    };
    providerAccessToken: string;
    apiAccessToken: string;
}