import { Session } from "next-auth";

export interface ApiSession extends Session {
    providerAccessToken?: string;
  apiAccessToken?: string;
}