import { Session } from "next-auth";

export interface AppSession extends Session {
    providerAccessToken?: string;
    apiAccessToken?: string;
}