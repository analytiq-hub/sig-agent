import NextAuth, { NextAuthOptions } from "next-auth"
import { MongoDBAdapter } from "@auth/mongodb-adapter"
import client from "./lib/mongodb"

import GithubProvider from "next-auth/providers/github";
import GoogleProvider from "next-auth/providers/google";
import { JWT } from "next-auth/jwt";
import { Account, Session } from "next-auth";

interface CustomSession extends Session {
  accessToken?: string;
}

const authOptions: NextAuthOptions = {
    session: {
        strategy: 'jwt' as const,
    },
    adapter: MongoDBAdapter(client),
    secret: process.env.NEXTAUTH_SECRET ?? "", // Needed else we get JWT Google error
    providers: [
      GithubProvider({
        clientId: process.env.AUTH_GITHUB_ID ?? "", // ?? only considers null or undefined as false
        clientSecret: process.env.AUTH_GITHUB_SECRET ?? "",
      }),
      GoogleProvider({
        clientId: process.env.AUTH_GOOGLE_ID ?? "",
        clientSecret: process.env.AUTH_GOOGLE_SECRET ?? "",
      })
    ],
    callbacks: {
      async jwt({ token, account }: { token: JWT; account: Account | null }) {
        // Persist the OAuth access_token to the token right after signin
        if (account) {
          token.accessToken = account.access_token
        }
        console.log('token', token);
        return token
      },
      async session({ session, token }: { session: Session; token: JWT }) {
        // Send properties to the client, like an access_token from a provider.
        (session as CustomSession).accessToken = token.accessToken as string;
        console.log('session', session);
        return session as CustomSession;
      }
    }
  };
 
export const handlers = NextAuth(authOptions);
